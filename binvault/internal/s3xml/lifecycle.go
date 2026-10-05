package s3xml

import (
	"encoding/xml"
	"math"
	"sort"
)

// LifecycleRule is binvault's lifecycle rule model (bucket setting
// "lifecycle", spec §3.12 and §6.3), the input of LifecycleXML. Zero values
// mean "not set"; MinSize and MaxSize are inclusive byte bounds, as everywhere
// in binvault (spec §7.3).
type LifecycleRule struct {
	ID                  string
	Enabled             bool
	Prefix              string
	Tags                map[string]string
	MinSize, MaxSize    int64
	ExpireDays          int
	ExpireDeleteMarkers bool
	NoncurrentDays      int
	NoncurrentKeep      int
	AbortMultipartDays  int
}

// DeleteMarkerRuleSuffix is appended to a rule's ID for the second S3 rule
// LifecycleXML emits when a binvault rule has both expire_days and
// expire_delete_markers.
const DeleteMarkerRuleSuffix = "-delete-markers"

// LifecycleConfiguration answers GetBucketLifecycleConfiguration (spec §3.12).
// Callers answer NoSuchLifecycleConfiguration instead when there are no rules.
type LifecycleConfiguration struct {
	XMLName xml.Name           `xml:"LifecycleConfiguration"`
	Rules   []LifecycleRuleXML `xml:"Rule"`
}

// LifecycleRuleXML is one S3 <Rule>. Filter is always written; an empty
// <Filter> applies to every object.
type LifecycleRuleXML struct {
	ID                             string                          `xml:"ID,omitempty"`
	Filter                         LifecycleFilter                 `xml:"Filter"`
	Status                         string                          `xml:"Status"`
	Expiration                     *LifecycleExpiration            `xml:"Expiration,omitempty"`
	NoncurrentVersionExpiration    *NoncurrentVersionExpiration    `xml:"NoncurrentVersionExpiration,omitempty"`
	AbortIncompleteMultipartUpload *AbortIncompleteMultipartUpload `xml:"AbortIncompleteMultipartUpload,omitempty"`
}

// LifecycleFilter is a rule's <Filter>: at most one condition directly, or
// several under <And>. The size bounds are exclusive, as in S3.
type LifecycleFilter struct {
	Prefix                string        `xml:"Prefix,omitempty"`
	Tag                   *Tag          `xml:"Tag,omitempty"`
	ObjectSizeGreaterThan *int64        `xml:"ObjectSizeGreaterThan,omitempty"`
	ObjectSizeLessThan    *int64        `xml:"ObjectSizeLessThan,omitempty"`
	And                   *LifecycleAnd `xml:"And,omitempty"`
}

// LifecycleAnd is the <And> of a filter with more than one condition.
type LifecycleAnd struct {
	Prefix                string `xml:"Prefix,omitempty"`
	Tags                  []Tag  `xml:"Tag"`
	ObjectSizeGreaterThan *int64 `xml:"ObjectSizeGreaterThan,omitempty"`
	ObjectSizeLessThan    *int64 `xml:"ObjectSizeLessThan,omitempty"`
}

// LifecycleExpiration is a rule's <Expiration>. S3 allows Days or
// ExpiredObjectDeleteMarker, never both.
type LifecycleExpiration struct {
	Days                      int  `xml:"Days,omitempty"`
	ExpiredObjectDeleteMarker bool `xml:"ExpiredObjectDeleteMarker,omitempty"`
}

// NoncurrentVersionExpiration is a rule's <NoncurrentVersionExpiration>.
type NoncurrentVersionExpiration struct {
	NoncurrentDays          int `xml:"NoncurrentDays"`
	NewerNoncurrentVersions int `xml:"NewerNoncurrentVersions,omitempty"`
}

// AbortIncompleteMultipartUpload is a rule's <AbortIncompleteMultipartUpload>.
type AbortIncompleteMultipartUpload struct {
	DaysAfterInitiation int `xml:"DaysAfterInitiation"`
}

// LifecycleXML renders binvault rules as the S3 document, in order:
//
//   - id → ID, enabled → Status Enabled/Disabled;
//   - the filter → Prefix, Tag, ObjectSizeGreaterThan (min_size-1) or
//     ObjectSizeLessThan (max_size+1) alone, under <And> (tags sorted by key)
//     when there are several, or an empty <Filter>;
//   - expire_days → Expiration/Days; noncurrent_days (with noncurrent_keep) →
//     NoncurrentVersionExpiration; abort_multipart_days →
//     AbortIncompleteMultipartUpload/DaysAfterInitiation;
//   - expire_delete_markers → Expiration/ExpiredObjectDeleteMarker. S3 forbids
//     it next to Days in one Expiration, so a rule that has both becomes two
//     S3 rules: the first with everything else, the second with the same
//     filter and status, ID + DeleteMarkerRuleSuffix, and only the
//     delete-marker expiration.
//
// noncurrent_keep without noncurrent_days has no S3 form and no effect (spec
// §3.12), so it is not written.
func LifecycleXML(rules []LifecycleRule) LifecycleConfiguration {
	var c LifecycleConfiguration
	for _, r := range rules {
		x := LifecycleRuleXML{ID: r.ID, Filter: lifecycleFilter(r), Status: "Disabled"}
		if r.Enabled {
			x.Status = "Enabled"
		}
		if r.ExpireDays > 0 {
			x.Expiration = &LifecycleExpiration{Days: r.ExpireDays}
		}
		if r.NoncurrentDays > 0 {
			x.NoncurrentVersionExpiration = &NoncurrentVersionExpiration{NoncurrentDays: r.NoncurrentDays}
			if r.NoncurrentKeep > 0 {
				x.NoncurrentVersionExpiration.NewerNoncurrentVersions = r.NoncurrentKeep
			}
		}
		if r.AbortMultipartDays > 0 {
			x.AbortIncompleteMultipartUpload = &AbortIncompleteMultipartUpload{DaysAfterInitiation: r.AbortMultipartDays}
		}
		if r.ExpireDeleteMarkers && x.Expiration == nil {
			x.Expiration = &LifecycleExpiration{ExpiredObjectDeleteMarker: true}
			c.Rules = append(c.Rules, x)
			continue
		}
		c.Rules = append(c.Rules, x)
		if r.ExpireDeleteMarkers {
			id := r.ID + DeleteMarkerRuleSuffix
			if r.ID == "" {
				id = DeleteMarkerRuleSuffix[1:]
			}
			c.Rules = append(c.Rules, LifecycleRuleXML{
				ID:         id,
				Filter:     lifecycleFilter(r),
				Status:     x.Status,
				Expiration: &LifecycleExpiration{ExpiredObjectDeleteMarker: true},
			})
		}
	}
	return c
}

// lifecycleFilter maps binvault's inclusive filter onto S3's exclusive one.
func lifecycleFilter(r LifecycleRule) LifecycleFilter {
	var gt, lt *int64
	if r.MinSize > 0 {
		v := r.MinSize - 1
		gt = &v
	}
	if r.MaxSize > 0 && r.MaxSize < math.MaxInt64 {
		v := r.MaxSize + 1
		lt = &v
	}
	tags := make([]Tag, 0, len(r.Tags))
	for k, v := range r.Tags {
		tags = append(tags, Tag{Key: k, Value: v})
	}
	sort.Slice(tags, func(i, j int) bool { return tags[i].Key < tags[j].Key })

	n := len(tags)
	for _, set := range []bool{r.Prefix != "", gt != nil, lt != nil} {
		if set {
			n++
		}
	}
	switch {
	case n == 0:
		return LifecycleFilter{}
	case n > 1:
		return LifecycleFilter{And: &LifecycleAnd{Prefix: r.Prefix, Tags: tags, ObjectSizeGreaterThan: gt, ObjectSizeLessThan: lt}}
	case len(tags) == 1:
		return LifecycleFilter{Tag: &tags[0]}
	}
	return LifecycleFilter{Prefix: r.Prefix, ObjectSizeGreaterThan: gt, ObjectSizeLessThan: lt}
}
