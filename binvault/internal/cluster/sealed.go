package cluster

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/seal"
)

// Sealed values travel inside pipeline registers (PipelineEntry.Sealed) and stay
// sealed on every node (§4.7, §8.5). `validate` and boot must open all of them,
// and `binvault rekey` must re-seal all of them — the registers and the ops of
// the log — so the old master key can be dropped. These two functions are the
// catalog's part of those commands; the application calls them next to its own
// checks.

// CheckSealed opens every sealed value held in the catalog (the live pipeline
// registers and the pipeline ops still in the log) and describes each one the
// keyring cannot open, plus the number of values checked (spec §4.7: boot and
// `validate` fail and name the records that cannot be opened).
func CheckSealed(ctx context.Context, db *meta.DB, ring *seal.Keyring) (problems []string, checked int, err error) {
	q := db.Read()
	check := func(where string, e *PipelineEntry) {
		for field, sv := range e.Sealed {
			checked++
			if _, err := ring.Open(sv.Type, sv.ID, sv.Value); err != nil {
				problems = append(problems, fmt.Sprintf("catalog %s, sealed %s: %v", where, field, err))
			}
		}
	}
	after := ""
	for {
		regs, err := q.CatalogListRegs(ctx, KindPipeline, after, 200, false)
		if err != nil {
			return nil, 0, err
		}
		for i := range regs {
			after = regs[i].Name
			var e PipelineEntry
			if err := json.Unmarshal(regs[i].Payload, &e); err != nil {
				problems = append(problems, fmt.Sprintf("catalog pipeline/%s: unreadable: %v", regs[i].Name, err))
				continue
			}
			check("pipeline/"+regs[i].Name, &e)
		}
		if len(regs) < 200 {
			break
		}
	}
	ops, err := q.CatalogOpsByKind(ctx, KindPipeline)
	if err != nil {
		return nil, 0, err
	}
	for i := range ops {
		if isTombstone(ops[i].Payload) {
			continue
		}
		var e PipelineEntry
		if err := json.Unmarshal(ops[i].Payload, &e); err != nil {
			problems = append(problems, fmt.Sprintf("catalog op %s: unreadable: %v", ops[i].ID(), err))
			continue
		}
		check("op "+ops[i].ID()+" (pipeline/"+ops[i].Key+")", &e)
	}
	return problems, checked, nil
}

// RekeyCatalog re-seals every sealed value in the catalog under the current key
// of the ring, inside tx: the live pipeline registers and the pipeline ops still
// in the log (§4.7). It returns how many values were rewritten. A value that
// cannot be opened fails the whole call and nothing is replaced. The same old
// ciphertext becomes the same new ciphertext everywhere it occurs, so a register
// and the op that wrote it stay byte-identical.
func RekeyCatalog(ctx context.Context, tx *meta.Tx, ring *seal.Keyring) (int, error) {
	changed := 0
	cache := map[string][]byte{}
	reseal := func(where string, sv SealedValue) (SealedValue, bool, error) {
		if out, ok := cache[string(sv.Value)]; ok {
			return SealedValue{Type: sv.Type, ID: sv.ID, Value: out}, true, nil
		}
		out, ch, err := ring.Reseal(sv.Type, sv.ID, sv.Value)
		if err != nil {
			return sv, false, fmt.Errorf("catalog %s: %w", where, err)
		}
		if !ch {
			return sv, false, nil
		}
		cache[string(sv.Value)] = out
		changed++
		return SealedValue{Type: sv.Type, ID: sv.ID, Value: out}, true, nil
	}
	// returns the new payload, or nil when nothing changed
	rewrite := func(where string, payload []byte) ([]byte, error) {
		if isTombstone(payload) {
			return nil, nil
		}
		var e PipelineEntry
		if err := json.Unmarshal(payload, &e); err != nil {
			return nil, fmt.Errorf("catalog %s: unreadable: %w", where, err)
		}
		dirty := false
		for field, sv := range e.Sealed {
			nv, ch, err := reseal(where+", sealed "+field, sv)
			if err != nil {
				return nil, err
			}
			if ch {
				e.Sealed[field] = nv
				dirty = true
			}
		}
		if !dirty {
			return nil, nil
		}
		return e.canonical()
	}
	after := ""
	for {
		regs, err := tx.CatalogListRegs(ctx, KindPipeline, after, 200, false)
		if err != nil {
			return changed, err
		}
		for i := range regs {
			after = regs[i].Name
			out, err := rewrite("pipeline/"+regs[i].Name, regs[i].Payload)
			if err != nil {
				return changed, err
			}
			if out != nil {
				if err := tx.CatalogSetRegPayload(ctx, regs[i].Key, out); err != nil {
					return changed, err
				}
			}
		}
		if len(regs) < 200 {
			break
		}
	}
	ops, err := tx.CatalogOpsByKind(ctx, KindPipeline)
	if err != nil {
		return changed, err
	}
	for i := range ops {
		out, err := rewrite("op "+ops[i].ID()+" (pipeline/"+ops[i].Key+")", ops[i].Payload)
		if err != nil {
			return changed, err
		}
		if out != nil {
			if err := tx.CatalogSetOpPayload(ctx, ops[i].Origin, ops[i].Seq, out); err != nil {
				return changed, err
			}
		}
	}
	return changed, nil
}
