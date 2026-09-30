package diskstat

import "testing"

func TestOfTempDir(t *testing.T) {
	u, err := Of(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if u.TotalBytes == 0 {
		t.Fatal("total is 0")
	}
	if u.UsedBytes > u.TotalBytes || u.AvailableBytes > u.TotalBytes {
		t.Fatalf("used %d / available %d exceed total %d", u.UsedBytes, u.AvailableBytes, u.TotalBytes)
	}
}

func TestOfMissingPath(t *testing.T) {
	if _, err := Of("/definitely/not/here/nginxpilot"); err == nil {
		t.Fatal("want an error for a missing path")
	}
}
