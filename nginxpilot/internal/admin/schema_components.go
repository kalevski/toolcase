package admin

// componentSchemas holds the hand-kept entity schemas the operations reference.
// Shapes mirror the Go structs' JSON serialization (internal/config types +
// the admin DTOs); the reflection-adjacent contract tests on the consumer side
// (Perch's fixtures) exercise the same shapes end-to-end.
func componentSchemas() map[string]any {
	str := func() map[string]any { return map[string]any{"type": "string"} }
	boolean := func() map[string]any { return map[string]any{"type": "boolean"} }
	integer := func() map[string]any { return map[string]any{"type": "integer"} }
	arr := func(items map[string]any) map[string]any {
		return map[string]any{"type": "array", "items": items}
	}
	ref := func(name string) map[string]any { return map[string]any{"$ref": "#/components/schemas/" + name} }
	obj := func(props map[string]any, required ...string) map[string]any {
		out := map[string]any{"type": "object", "properties": props}
		if len(required) > 0 {
			out["required"] = required
		}
		return out
	}
	strEnum := func(values ...string) map[string]any {
		return map[string]any{"type": "string", "enum": values}
	}

	webOptions := map[string]any{
		"tls":            strEnum("off", "auto", "required"),
		"force_ssl":      boolean(),
		"http2":          boolean(),
		"hsts":           ref("HSTS"),
		"block_exploits": boolean(),
		"gzip":           boolean(),
		"advanced":       str(),
	}
	withWebOptions := func(props map[string]any) map[string]any {
		for k, v := range webOptions {
			props[k] = v
		}
		return props
	}

	return map[string]any{
		"HSTS": obj(map[string]any{
			"enabled":            boolean(),
			"max_age":            integer(),
			"include_subdomains": boolean(),
			"preload":            boolean(),
		}),

		"Site": obj(withWebOptions(map[string]any{
			"domain":  str(),
			"source":  map[string]any{"type": "object"},
			"exclude": arr(str()),
		}), "domain"),
		"SiteList": obj(map[string]any{"sites": arr(ref("Site"))}),

		"UpstreamServer": obj(map[string]any{
			"address":      str(),
			"weight":       integer(),
			"max_fails":    integer(),
			"fail_timeout": str(),
			"backup":       boolean(),
			"down":         boolean(),
		}, "address"),
		"Upstream": obj(map[string]any{
			"name":      str(),
			"balancer":  strEnum("", "round_robin", "least_conn", "ip_hash"),
			"keepalive": integer(),
			"servers":   arr(ref("UpstreamServer")),
		}, "name", "servers"),
		"UpstreamList": obj(map[string]any{"upstreams": arr(ref("Upstream"))}),

		"ProxyLocation": obj(map[string]any{
			"path":      str(),
			"upstream":  str(),
			"pass":      str(),
			"websocket": boolean(),
			"advanced":  str(),
		}, "path"),
		"Proxy": obj(withWebOptions(map[string]any{
			"domain":               str(),
			"enabled":              boolean(),
			"listen":               integer(),
			"upstream":             str(),
			"pass":                 str(),
			"locations":            arr(ref("ProxyLocation")),
			"connect_timeout":      str(),
			"read_timeout":         str(),
			"send_timeout":         str(),
			"client_max_body_size": str(),
			"access_list":          str(),
			"websocket":            boolean(),
			"cache":                map[string]any{"type": "object"},
		}), "domain"),
		"ProxyList": obj(map[string]any{"proxies": arr(ref("Proxy"))}),

		"Redirect": obj(withWebOptions(map[string]any{
			"domain":        str(),
			"enabled":       boolean(),
			"listen":        integer(),
			"to":            str(),
			"scheme":        strEnum("auto", "http", "https"),
			"code":          map[string]any{"type": "integer", "enum": []int{301, 302, 303, 307, 308}},
			"preserve_path": boolean(),
			"access_list":   str(),
		}), "domain", "to"),
		"RedirectList": obj(map[string]any{"redirects": arr(ref("Redirect"))}),

		"DeadHost": obj(withWebOptions(map[string]any{
			"domain":      str(),
			"enabled":     boolean(),
			"listen":      integer(),
			"code":        map[string]any{"type": "integer", "enum": []int{404, 410, 444, 503}},
			"access_list": str(),
		}), "domain"),
		"DeadHostList": obj(map[string]any{"dead_hosts": arr(ref("DeadHost"))}),

		"AccessRule": obj(map[string]any{"allow": str(), "deny": str()}),
		"AccessListUser": obj(map[string]any{
			"username":     str(),
			"has_password": boolean(),
		}, "username"),
		"AccessList": obj(map[string]any{
			"name":      str(),
			"satisfy":   strEnum("all", "any"),
			"pass_auth": boolean(),
			"users":     arr(ref("AccessListUser")),
			"rules":     arr(ref("AccessRule")),
		}, "name"),
		"AccessListList":     obj(map[string]any{"access_lists": arr(ref("AccessList"))}),
		"SetPasswordRequest": obj(map[string]any{"password": str()}, "password"),

		"StreamServer": obj(map[string]any{
			"address":      str(),
			"weight":       integer(),
			"max_fails":    integer(),
			"fail_timeout": str(),
			"backup":       boolean(),
			"down":         boolean(),
		}, "address"),
		"StreamUpstream": obj(map[string]any{
			"name":     str(),
			"balancer": strEnum("", "round_robin", "least_conn", "hash"),
			"servers":  arr(ref("StreamServer")),
		}, "name", "servers"),
		"StreamUpstreamList": obj(map[string]any{"stream_upstreams": arr(ref("StreamUpstream"))}),
		"Stream": obj(map[string]any{
			"name":            str(),
			"listen":          integer(),
			"protocol":        strEnum("tcp", "udp"),
			"upstream":        str(),
			"pass":            str(),
			"proxy_protocol":  boolean(),
			"connect_timeout": str(),
			"timeout":         str(),
			"tls":             strEnum("off", "auto", "required"),
			"tls_domain":      str(),
		}, "name", "listen"),
		"StreamList": obj(map[string]any{"streams": arr(ref("Stream"))}),

		"ResourceResult": obj(map[string]any{
			"kind":           str(),
			"key":            str(),
			"file":           str(),
			"state":          strEnum("active", "disabled", "at_risk"),
			"reason":         str(),
			"since":          str(),
			"last_reconcile": str(),
		}, "kind", "key", "state"),
		"NginxTestResult": obj(map[string]any{
			"resources": arr(ref("ResourceResult")),
			"error":     str(),
		}),
		"Status": obj(map[string]any{
			"sites": arr(map[string]any{"type": "object"}),
			"nginx": obj(map[string]any{
				"managed":        boolean(),
				"resources":      arr(ref("ResourceResult")),
				"disabled_count": integer(),
				"at_risk_count":  integer(),
				"reconcile":      map[string]any{"type": "object"},
				"real_ip":        ref("RealIPStatus"),
			}),
			"certs_renewal": obj(map[string]any{
				"enabled":        boolean(),
				"check_interval": str(),
				"renew_before":   str(),
				"next_check":     str(),
			}),
		}),
		"RealIPStatus": obj(map[string]any{
			"enabled":      boolean(),
			"header":       str(),
			"recursive":    boolean(),
			"providers":    arr(str()),
			"static_count": integer(),
			"range_count":  integer(),
			"last_refresh": str(),
			"last_error":   str(),
		}),

		"WriteResult": obj(map[string]any{
			"status":   strEnum("created", "updated"),
			"warnings": arr(str()),
		}, "status"),

		"Cert": obj(map[string]any{
			"domain":             str(),
			"names":              arr(str()),
			"cert_path":          str(),
			"key_path":           str(),
			"mod_time":           str(),
			"not_before":         str(),
			"not_after":          str(),
			"issuer":             str(),
			"expires_in_seconds": integer(),
			"renew_managed":      boolean(),
			"last_renew_time":    str(),
			"last_renew_error":   str(),
		}, "domain", "names", "renew_managed"),
		"CertList": obj(map[string]any{"cert_dir": str(), "certs": arr(ref("Cert"))}),
		"IssueCertRequest": obj(map[string]any{
			"domains":   arr(str()),
			"cert_name": str(),
			"email":     str(),
			"provider":  str(),
			"staging":   boolean(),
		}, "domains"),
		"CertIssueAccepted": obj(map[string]any{
			"status":    str(),
			"job_id":    str(),
			"state":     strEnum("pending", "running", "succeeded", "failed"),
			"cert_name": str(),
			"domains":   arr(str()),
		}, "job_id", "state"),
		"CertJob": obj(map[string]any{
			"id":         str(),
			"state":      strEnum("pending", "running", "succeeded", "failed"),
			"cert_name":  str(),
			"domains":    arr(str()),
			"staging":    boolean(),
			"error":      str(),
			"cert":       ref("Cert"),
			"created_at": str(),
			"updated_at": str(),
		}, "id", "state"),
		"CertJobList":       obj(map[string]any{"jobs": arr(ref("CertJob"))}),
		"UploadCertRequest": obj(map[string]any{"cert": str(), "key": str()}, "cert", "key"),
		"CertUploadResult": obj(map[string]any{
			"status": strEnum("created", "replaced"),
			"domain": str(),
			"cert":   ref("Cert"),
		}, "status", "domain"),

		"AcmeCredential": obj(map[string]any{
			"provider":  str(),
			"mechanism": str(),
			"mod_time":  str(),
		}, "provider", "mechanism"),
		"AcmeCredentialList": obj(map[string]any{"credentials": arr(ref("AcmeCredential"))}),
		"AcmeCredentialRequest": obj(map[string]any{
			"credentials":          str(),
			"token":                str(),
			"access_key":           str(),
			"secret_key":           str(),
			"service_account_json": str(),
		}),
		"AcmeCredentialResult": obj(map[string]any{
			"status":    strEnum("created", "replaced"),
			"provider":  str(),
			"mechanism": str(),
		}, "status", "provider"),
	}
}
