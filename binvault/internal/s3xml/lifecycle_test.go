package s3xml

import (
	"bytes"
	"math"
	"reflect"
	"testing"
)

func TestLifecycleXML(t *testing.T) {
	cases := []struct {
		name string
		in   LifecycleRule
		want []LifecycleRuleXML
	}{
		{"empty filter, disabled, no actions",
			LifecycleRule{ID: "noop"},
			[]LifecycleRuleXML{{ID: "noop", Status: "Disabled"}}},
		{"prefix and expiry",
			LifecycleRule{ID: "scratch", Enabled: true, Prefix: "tmp/", ExpireDays: 2},
			[]LifecycleRuleXML{{ID: "scratch", Filter: LifecycleFilter{Prefix: "tmp/"}, Status: "Enabled", Expiration: &LifecycleExpiration{Days: 2}}}},
		{"single tag stands alone",
			LifecycleRule{ID: "t", Enabled: true, Tags: map[string]string{"scan": "infected"}, ExpireDays: 1},
			[]LifecycleRuleXML{{ID: "t", Filter: LifecycleFilter{Tag: &Tag{Key: "scan", Value: "infected"}}, Status: "Enabled", Expiration: &LifecycleExpiration{Days: 1}}}},
		{"min size alone, inclusive becomes exclusive",
			LifecycleRule{ID: "big", Enabled: true, MinSize: 1, ExpireDays: 3},
			[]LifecycleRuleXML{{ID: "big", Filter: LifecycleFilter{ObjectSizeGreaterThan: i64(0)}, Status: "Enabled", Expiration: &LifecycleExpiration{Days: 3}}}},
		{"max size alone",
			LifecycleRule{ID: "small", Enabled: true, MaxSize: 1023, ExpireDays: 3},
			[]LifecycleRuleXML{{ID: "small", Filter: LifecycleFilter{ObjectSizeLessThan: i64(1024)}, Status: "Enabled", Expiration: &LifecycleExpiration{Days: 3}}}},
		{"max size at the int64 limit means no bound",
			LifecycleRule{ID: "all", Enabled: true, MaxSize: math.MaxInt64, ExpireDays: 3},
			[]LifecycleRuleXML{{ID: "all", Status: "Enabled", Expiration: &LifecycleExpiration{Days: 3}}}},
		{"several conditions go under And, tags sorted",
			LifecycleRule{ID: "and", Enabled: true, Prefix: "logs/", Tags: map[string]string{"z": "1", "a": "2"}, MinSize: 10, MaxSize: 20, ExpireDays: 5},
			[]LifecycleRuleXML{{ID: "and", Status: "Enabled", Expiration: &LifecycleExpiration{Days: 5},
				Filter: LifecycleFilter{And: &LifecycleAnd{Prefix: "logs/", Tags: []Tag{{"a", "2"}, {"z", "1"}}, ObjectSizeGreaterThan: i64(9), ObjectSizeLessThan: i64(21)}}}}},
		{"prefix and one tag go under And",
			LifecycleRule{ID: "pt", Enabled: true, Prefix: "p/", Tags: map[string]string{"k": "v"}, AbortMultipartDays: 1},
			[]LifecycleRuleXML{{ID: "pt", Status: "Enabled", Filter: LifecycleFilter{And: &LifecycleAnd{Prefix: "p/", Tags: []Tag{{"k", "v"}}}},
				AbortIncompleteMultipartUpload: &AbortIncompleteMultipartUpload{DaysAfterInitiation: 1}}}},
		{"two tags go under And",
			LifecycleRule{ID: "tt", Tags: map[string]string{"b": "2", "a": "1"}, ExpireDays: 1},
			[]LifecycleRuleXML{{ID: "tt", Status: "Disabled", Filter: LifecycleFilter{And: &LifecycleAnd{Tags: []Tag{{"a", "1"}, {"b", "2"}}}},
				Expiration: &LifecycleExpiration{Days: 1}}}},
		{"delete markers alone share the rule",
			LifecycleRule{ID: "history", Enabled: true, NoncurrentDays: 30, NoncurrentKeep: 5, ExpireDeleteMarkers: true},
			[]LifecycleRuleXML{{ID: "history", Status: "Enabled", Expiration: &LifecycleExpiration{ExpiredObjectDeleteMarker: true},
				NoncurrentVersionExpiration: &NoncurrentVersionExpiration{NoncurrentDays: 30, NewerNoncurrentVersions: 5}}}},
		{"days and delete markers become two rules",
			LifecycleRule{ID: "both", Enabled: true, Prefix: "tmp/", ExpireDays: 7, ExpireDeleteMarkers: true, NoncurrentDays: 1, AbortMultipartDays: 2},
			[]LifecycleRuleXML{
				{ID: "both", Status: "Enabled", Filter: LifecycleFilter{Prefix: "tmp/"}, Expiration: &LifecycleExpiration{Days: 7},
					NoncurrentVersionExpiration:    &NoncurrentVersionExpiration{NoncurrentDays: 1},
					AbortIncompleteMultipartUpload: &AbortIncompleteMultipartUpload{DaysAfterInitiation: 2}},
				{ID: "both-delete-markers", Status: "Enabled", Filter: LifecycleFilter{Prefix: "tmp/"}, Expiration: &LifecycleExpiration{ExpiredObjectDeleteMarker: true}},
			}},
		{"two rules without an id",
			LifecycleRule{ExpireDays: 7, ExpireDeleteMarkers: true},
			[]LifecycleRuleXML{
				{Status: "Disabled", Expiration: &LifecycleExpiration{Days: 7}},
				{ID: "delete-markers", Status: "Disabled", Expiration: &LifecycleExpiration{ExpiredObjectDeleteMarker: true}},
			}},
		{"noncurrent keep without days is not written",
			LifecycleRule{ID: "keep", Enabled: true, NoncurrentKeep: 3},
			[]LifecycleRuleXML{{ID: "keep", Status: "Enabled"}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := LifecycleXML([]LifecycleRule{tc.in}).Rules
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got  %#v\nwant %#v", got, tc.want)
			}
			out, err := Marshal(LifecycleConfiguration{Rules: got})
			if err != nil {
				t.Fatal(err)
			}
			if bytes.Contains(out, []byte("<Days>")) && bytes.Count(out, []byte("<Expiration>")) == 1 && bytes.Contains(out, []byte("<ExpiredObjectDeleteMarker>")) {
				t.Fatalf("Days and ExpiredObjectDeleteMarker in one rule:\n%s", out)
			}
			if !bytes.Contains(out, []byte("<Filter>")) {
				t.Fatalf("every rule carries a Filter:\n%s", out)
			}
		})
	}
	if c := LifecycleXML(nil); len(c.Rules) != 0 {
		t.Fatalf("no rules: %+v", c)
	}
}
