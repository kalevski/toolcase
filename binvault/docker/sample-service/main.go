// Command sample-service is a tiny binvault pipeline service for the compose
// example (spec §7.15). It needs nothing but the standard library: binvault
// hands it a pipeline token, and the `Authorization: Bearer <id>.<secret>`
// form of that token is enough to read and tag objects over plain HTTP.
//
//	content-gate (before)   reads the staged upload and rejects (422) anything
//	                        that contains the marker string; otherwise 204
//	tag-hash     (after)    reads the stored object and records its SHA-256 as
//	                        the tag `sha256` (no new version, no event)
//
// Anything else is answered 204 and logged.
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// invocation is the part of binvault's request body (spec §7.6) this service uses.
type invocation struct {
	Run      struct{ ID string } `json:"run"`
	Pipeline string              `json:"pipeline"`
	Stage    string              `json:"stage"`
	Event    string              `json:"event"`
	Bucket   string              `json:"bucket"`
	Key      string              `json:"key"`
	Object   struct {
		Version string `json:"version"`
		Size    int64  `json:"size"`
	} `json:"object"`
	S3 *struct {
		Endpoint string `json:"endpoint"`
		Bearer   string `json:"bearer"`
	} `json:"s3"`
}

func main() {
	addr := env("LISTEN", ":8080")
	secret := os.Getenv("SIGNING_SECRET")
	banned := env("BANNED_MARKER", "EICAR-TEST-MARKER")
	mux := http.NewServeMux()
	mux.HandleFunc("POST /hooks/binvault", func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err != nil {
			http.Error(w, "bad body", http.StatusBadRequest)
			return
		}
		if secret != "" && !verify(secret, r.Header.Get("X-Binvault-Timestamp"), r.Header.Get("X-Binvault-Signature"), body) {
			http.Error(w, "bad signature", http.StatusUnauthorized)
			return
		}
		var inv invocation
		if err := json.Unmarshal(body, &inv); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		log.Printf("run=%s attempt=%s pipeline=%s stage=%s event=%s %s/%s",
			inv.Run.ID, r.Header.Get("X-Binvault-Attempt"), inv.Pipeline, inv.Stage, inv.Event, inv.Bucket, inv.Key)
		switch inv.Pipeline {
		case "content-gate":
			gate(w, &inv, banned)
		case "tag-hash":
			tagHash(w, &inv)
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	})
	log.Printf("sample-service listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// verify checks X-Binvault-Signature: "v1=" + hex HMAC-SHA256 of "<ts>.<body>",
// and rejects timestamps more than five minutes old (spec §7.6).
func verify(secret, ts, sig string, body []byte) bool {
	n, err := strconv.ParseInt(ts, 10, 64)
	if err != nil || time.Since(time.Unix(n, 0)).Abs() > 5*time.Minute {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(ts + "."))
	mac.Write(body)
	return hmac.Equal([]byte("v1="+hex.EncodeToString(mac.Sum(nil))), []byte(sig))
}

func objectURL(inv *invocation, query string) string {
	parts := strings.Split(inv.Key, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	u := strings.TrimRight(inv.S3.Endpoint, "/") + "/" + url.PathEscape(inv.Bucket) + "/" + strings.Join(parts, "/")
	if query != "" {
		u += "?" + query
	}
	return u
}

func s3(inv *invocation, method, query string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, objectURL(inv, query), body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+inv.S3.Bearer)
	return http.DefaultClient.Do(req)
}

// gate reads the staged object and rejects it when it contains the marker.
func gate(w http.ResponseWriter, inv *invocation, banned string) {
	if inv.S3 == nil {
		http.Error(w, "no s3 token", http.StatusInternalServerError)
		return
	}
	res, err := s3(inv, http.MethodGet, "", nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		http.Error(w, "reading the staged object: "+res.Status, http.StatusBadGateway)
		return
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, 64<<20))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	if strings.Contains(string(data), banned) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnprocessableEntity)
		_ = json.NewEncoder(w).Encode(map[string]string{"message": "content scan failed: marker found"})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type tagging struct {
	XMLName xml.Name `xml:"Tagging"`
	TagSet  struct {
		Tag []struct{ Key, Value string } `xml:"Tag"`
	} `xml:"TagSet"`
}

// tagHash records the object's SHA-256 as a tag.
func tagHash(w http.ResponseWriter, inv *invocation) {
	if inv.S3 == nil {
		http.Error(w, "no s3 token", http.StatusInternalServerError)
		return
	}
	res, err := s3(inv, http.MethodGet, "versionId="+url.QueryEscape(inv.Object.Version), nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusPreconditionFailed || res.StatusCode == http.StatusNotFound {
		w.WriteHeader(http.StatusNoContent) // superseded or gone: nothing to do (spec §7.15)
		return
	}
	if res.StatusCode != http.StatusOK {
		http.Error(w, "reading the object: "+res.Status, http.StatusBadGateway)
		return
	}
	h := sha256.New()
	if _, err := io.Copy(h, res.Body); err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	doc := fmt.Sprintf(`<Tagging><TagSet><Tag><Key>sha256</Key><Value>%s</Value></Tag></TagSet></Tagging>`, hex.EncodeToString(h.Sum(nil)))
	put, err := s3(inv, http.MethodPut, "tagging&versionId="+url.QueryEscape(inv.Object.Version), strings.NewReader(doc))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer put.Body.Close()
	switch put.StatusCode {
	case http.StatusOK:
		w.WriteHeader(http.StatusNoContent)
	case http.StatusPreconditionFailed, http.StatusNotFound:
		w.WriteHeader(http.StatusNoContent)
	default:
		msg, _ := io.ReadAll(io.LimitReader(put.Body, 512))
		http.Error(w, "tagging: "+put.Status+" "+string(msg), http.StatusBadGateway)
	}
}
