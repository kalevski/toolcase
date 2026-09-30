package manager

import (
	"errors"
	"fmt"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/source"
	"github.com/kalevski/toolcase/nginxpilot/internal/state"
)

func TestRecordFailureClassifiesLimit(t *testing.T) {
	st := &state.SiteState{}
	err := fmt.Errorf("extract git archive: %w", &source.LimitError{Limit: "max_uncompressed_size", Max: 512 << 20, Msg: "limit exceeded: max_uncompressed_size (512MiB)"})
	recordFailure(st, err)
	if st.LastErrorCode != source.ErrorCodeLimitExceeded || st.LastErrorLimit != "max_uncompressed_size" || st.LastErrorLimitMax != 512<<20 {
		t.Fatalf("got %+v", st)
	}
	if st.LastError != err.Error() || st.FailureStreak != 1 {
		t.Fatalf("the sentence and streak must stay as before: %+v", st)
	}

	st.ClearFailure()
	if st.LastErrorCode != "" || st.LastErrorLimit != "" || st.LastErrorLimitMax != 0 || st.LastError != "" || st.FailureStreak != 0 {
		t.Fatalf("not cleared: %+v", st)
	}
}

func TestRecordFailureOtherErrorHasNoCode(t *testing.T) {
	st := &state.SiteState{}
	recordFailure(st, errors.New("clone failed"))
	if st.LastErrorCode != "" || st.LastErrorLimit != "" {
		t.Fatalf("got %+v", st)
	}
}
