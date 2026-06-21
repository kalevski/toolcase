import { describe, it, expect, vi } from 'vitest'
import { KVService } from '../../src/kv/KVService'
import { KV_LUA_SCRIPTS } from '../../src/kv/scripts'

function makeMinimalClient(scriptLoadImpl?: () => Promise<string>) {
    const client: Record<string, unknown> = {
        evalSha: vi.fn().mockResolvedValue([]),
        eval: vi.fn().mockResolvedValue([]),
        scriptLoad: scriptLoadImpl
            ? vi.fn().mockImplementation(scriptLoadImpl)
            : vi.fn().mockResolvedValue('ok'),
        duplicate: vi.fn().mockReturnValue({}),
    }
    client.withTypeMapping = vi.fn().mockReturnValue(client)
    return client
}

function makeKVService(client: Record<string, unknown>) {
    return new KVService({
        client: client as never,
        namespace: 'test',
    })
}

describe('KVService.warmScripts', () => {

    it('resolves and calls scriptLoad once per registered script', async () => {
        const client = makeMinimalClient()
        const kv = makeKVService(client)
        await expect(kv.warmScripts()).resolves.toBeUndefined()
        const scriptLoad = client.scriptLoad as ReturnType<typeof vi.fn>
        expect(scriptLoad).toHaveBeenCalledTimes(Object.keys(KV_LUA_SCRIPTS).length)
    })

    it('propagates a scriptLoad failure instead of swallowing it', async () => {
        const client = makeMinimalClient(() => Promise.reject(new Error('LOADING Redis')))
        const kv = makeKVService(client)
        await expect(kv.warmScripts()).rejects.toThrow('LOADING Redis')
    })
})

describe('KVService.popN', () => {

    it('clamps count to 1000 when a larger value is passed', async () => {
        const client = makeMinimalClient()
        const evalSha = client.evalSha as ReturnType<typeof vi.fn>
        evalSha.mockResolvedValue(['a', 'b'])
        const kv = makeKVService(client)
        const result = await kv.popN('queue', 9999)
        expect(result).toEqual(['a', 'b'])
        // evalSha is called by LuaScript.run
        const call = evalSha.mock.calls[0]
        expect(call[1].arguments[0]).toBe('1000')
    })

    it('passes the original count when it is within the cap', async () => {
        const client = makeMinimalClient()
        const evalSha = client.evalSha as ReturnType<typeof vi.fn>
        evalSha.mockResolvedValue(['x'])
        const kv = makeKVService(client)
        await kv.popN('queue', 50)
        const call = evalSha.mock.calls[0]
        expect(call[1].arguments[0]).toBe('50')
    })

    it('returns an empty array when the script returns a non-array', async () => {
        const client = makeMinimalClient()
        const evalSha = client.evalSha as ReturnType<typeof vi.fn>
        evalSha.mockResolvedValue(null)
        const kv = makeKVService(client)
        const result = await kv.popN('queue', 5)
        expect(result).toEqual([])
    })

    it('Lua script clamps count with math.min in source', () => {
        expect(KV_LUA_SCRIPTS.popN).toContain('math.min(tonumber(ARGV[1]), 1000)')
    })
})
