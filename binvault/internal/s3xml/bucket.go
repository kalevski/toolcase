package s3xml

import "encoding/xml"

// Owner is the <Owner> (and <Initiator>) element. binvault reports the bucket
// name as both ID and DisplayName (spec §5.2).
type Owner struct {
	ID          string `xml:"ID"`
	DisplayName string `xml:"DisplayName,omitempty"`
}

// Bucket is one <Bucket> of ListAllMyBucketsResult.
type Bucket struct {
	Name         string `xml:"Name"`
	CreationDate Time   `xml:"CreationDate"`
}

// ListAllMyBucketsResult answers ListBuckets (GET /, spec §5.3): the single
// bucket the credential belongs to. <Buckets> is written even when empty.
type ListAllMyBucketsResult struct {
	XMLName xml.Name `xml:"ListAllMyBucketsResult"`
	Owner   Owner    `xml:"Owner"`
	Buckets []Bucket `xml:"Buckets>Bucket"`
}

// LocationConstraint answers GetBucketLocation. S3 writes an empty element for
// us-east-1, so Region is "" there (spec §5.2).
type LocationConstraint struct {
	XMLName xml.Name `xml:"LocationConstraint"`
	Region  string   `xml:",chardata"`
}

// CreateBucketConfiguration is the optional CreateBucket request body. Read it
// with DecodeCreateBucket, which also accepts an empty body and a bare
// <LocationConstraint> root.
type CreateBucketConfiguration struct {
	XMLName            xml.Name `xml:"CreateBucketConfiguration"`
	LocationConstraint string   `xml:"LocationConstraint,omitempty"`
}

// VersioningConfiguration answers GetBucketVersioning (spec §3.10): Status
// "Enabled", or the zero value — an empty <VersioningConfiguration> — while
// versioning is off. It is also the PutBucketVersioning request body.
type VersioningConfiguration struct {
	XMLName   xml.Name `xml:"VersioningConfiguration"`
	Status    string   `xml:"Status,omitempty"`
	MFADelete string   `xml:"MfaDelete,omitempty"`
}

// ServerSideEncryptionConfiguration answers GetBucketEncryption (spec §3.11).
type ServerSideEncryptionConfiguration struct {
	XMLName xml.Name  `xml:"ServerSideEncryptionConfiguration"`
	Rules   []SSERule `xml:"Rule"`
}

// SSERule is one <Rule> of a ServerSideEncryptionConfiguration.
type SSERule struct {
	ApplyServerSideEncryptionByDefault *SSEByDefault `xml:"ApplyServerSideEncryptionByDefault,omitempty"`
	BucketKeyEnabled                   bool          `xml:"BucketKeyEnabled"`
}

// SSEByDefault is <ApplyServerSideEncryptionByDefault>.
type SSEByDefault struct {
	SSEAlgorithm   string `xml:"SSEAlgorithm"`
	KMSMasterKeyID string `xml:"KMSMasterKeyID,omitempty"`
}

// SSES3Config is the GetBucketEncryption answer for a bucket whose encryption
// setting is "sse-s3": AES256 by default, bucket keys off, as S3 reports it.
func SSES3Config() ServerSideEncryptionConfiguration {
	return ServerSideEncryptionConfiguration{Rules: []SSERule{{
		ApplyServerSideEncryptionByDefault: &SSEByDefault{SSEAlgorithm: "AES256"},
	}}}
}

// AccessControlPolicy is the GetBucketAcl / GetObjectAcl answer and the
// PutBucketAcl / PutObjectAcl request body. binvault only ever reports the
// fixed stub of StubACL (spec §5.2).
type AccessControlPolicy struct {
	XMLName           xml.Name `xml:"AccessControlPolicy"`
	Owner             Owner    `xml:"Owner"`
	AccessControlList []Grant  `xml:"AccessControlList>Grant"`
}

// Grant is one <Grant> of an AccessControlList.
type Grant struct {
	Grantee    Grantee `xml:"Grantee"`
	Permission string  `xml:"Permission"`
}

const xsiNS = "http://www.w3.org/2001/XMLSchema-instance"

// Grantee is a <Grantee>. Type is its xsi:type attribute: "CanonicalUser"
// (ID, DisplayName), "Group" (URI) or "AmazonCustomerByEmail" (EmailAddress).
type Grantee struct {
	Type         string
	ID           string
	DisplayName  string
	URI          string
	EmailAddress string
}

type granteeXML struct {
	ID           string `xml:"ID,omitempty"`
	DisplayName  string `xml:"DisplayName,omitempty"`
	URI          string `xml:"URI,omitempty"`
	EmailAddress string `xml:"EmailAddress,omitempty"`
}

// MarshalXML writes the grantee with the literal
// `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="…"`
// attributes S3 uses (encoding/xml would invent its own prefix otherwise).
func (g Grantee) MarshalXML(e *xml.Encoder, start xml.StartElement) error {
	start.Name = xml.Name{Local: "Grantee"}
	start.Attr = []xml.Attr{
		{Name: xml.Name{Local: "xmlns:xsi"}, Value: xsiNS},
		{Name: xml.Name{Local: "xsi:type"}, Value: g.Type},
	}
	return e.EncodeElement(granteeXML{g.ID, g.DisplayName, g.URI, g.EmailAddress}, start)
}

// UnmarshalXML reads the type from the xsi:type attribute, or from any
// attribute named "type" whatever its prefix, so clients that forget the
// xmlns:xsi declaration still parse.
func (g *Grantee) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	var x granteeXML
	if err := d.DecodeElement(&x, &start); err != nil {
		return err
	}
	*g = Grantee{ID: x.ID, DisplayName: x.DisplayName, URI: x.URI, EmailAddress: x.EmailAddress}
	for _, a := range start.Attr {
		if a.Name.Local == "type" && (a.Name.Space == xsiNS || g.Type == "") {
			g.Type = a.Value
		}
	}
	return nil
}

// StubACL is the fixed ACL binvault reports for buckets and objects: the
// owner with FULL_CONTROL (spec §5.2). Pass the bucket name as both arguments.
func StubACL(ownerID, ownerName string) AccessControlPolicy {
	owner := Owner{ID: ownerID, DisplayName: ownerName}
	return AccessControlPolicy{
		Owner: owner,
		AccessControlList: []Grant{{
			Grantee:    Grantee{Type: "CanonicalUser", ID: ownerID, DisplayName: ownerName},
			Permission: "FULL_CONTROL",
		}},
	}
}

// OwnerOnly reports whether every grant of a PutBucketAcl / PutObjectAcl body
// names the canonical user ownerID, so the ACL widens nobody's access and can
// be accepted and ignored like the "private" canned ACL (spec §5.2). Any grant
// to another user, a group or an e-mail address makes it false, and the
// request is AccessControlListNotSupported.
func (p AccessControlPolicy) OwnerOnly(ownerID string) bool {
	for _, g := range p.AccessControlList {
		if g.Grantee.Type != "CanonicalUser" && g.Grantee.Type != "" {
			return false
		}
		if g.Grantee.ID != ownerID || g.Grantee.URI != "" || g.Grantee.EmailAddress != "" {
			return false
		}
	}
	return true
}

// CORSRule is one CORS rule of the bucket settings (spec §6.3, §5.10) and its
// <CORSRule> element. MaxAgeSeconds 0 is omitted.
type CORSRule struct {
	ID             string   `xml:"ID,omitempty"`
	AllowedHeaders []string `xml:"AllowedHeader"`
	AllowedMethods []string `xml:"AllowedMethod"`
	AllowedOrigins []string `xml:"AllowedOrigin"`
	ExposeHeaders  []string `xml:"ExposeHeader"`
	MaxAgeSeconds  int      `xml:"MaxAgeSeconds,omitempty"`
}

// CORSConfiguration answers GetBucketCors (a read-only view, spec §5.2).
type CORSConfiguration struct {
	XMLName xml.Name   `xml:"CORSConfiguration"`
	Rules   []CORSRule `xml:"CORSRule"`
}

// CORSXML builds the GetBucketCors document from the bucket's rules. Callers
// answer NoSuchCORSConfiguration instead when there are none.
func CORSXML(rules []CORSRule) CORSConfiguration {
	return CORSConfiguration{Rules: append([]CORSRule(nil), rules...)}
}

// BucketLoggingStatus is the empty GetBucketLogging answer (spec §5.2).
type BucketLoggingStatus struct {
	XMLName xml.Name `xml:"BucketLoggingStatus"`
}

// NotificationConfiguration is the empty GetBucketNotificationConfiguration
// answer (spec §5.2).
type NotificationConfiguration struct {
	XMLName xml.Name `xml:"NotificationConfiguration"`
}

// RequestPaymentConfiguration answers GetBucketRequestPayment; binvault always
// reports Payer "BucketOwner" (spec §5.2).
type RequestPaymentConfiguration struct {
	XMLName xml.Name `xml:"RequestPaymentConfiguration"`
	Payer   string   `xml:"Payer"`
}
