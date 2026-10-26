package server

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/attachments"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/config"
)

type countingUpload struct {
	io.Reader
	read int64
}

func (r *countingUpload) Read(p []byte) (int, error) {
	n, err := r.Reader.Read(p)
	r.read += int64(n)
	return n, err
}

func TestAttachmentUploadLimitsHTTP(t *testing.T) {
	t.Cleanup(func() { _ = config.Load() })
	conn, _ := testdb.Open(t)
	t.Setenv("APP_ATTACHMENTS_MAX_FILE_BYTES", "8")
	t.Setenv("APP_ATTACHMENTS_MAX_TEMPLATE_BYTES", "12")
	temp := t.TempDir()
	t.Setenv("TMPDIR", temp)
	if err := config.Load(); err != nil {
		t.Fatal(err)
	}
	admin, viewer := auth.NewUser("admin@example.invalid", true, true, nil), auth.NewUser("viewer@example.invalid", true, false, nil)
	for _, user := range []*auth.User{admin, viewer} {
		if err := conn.Create(user).Error; err != nil {
			t.Fatal(err)
		}
	}
	template := models.NewEmailTemplate("Upload", "Subject", "Message")
	if err := conn.Create(template).Error; err != nil {
		t.Fatal(err)
	}
	app := NewServer().WithAuthProvider(&budgetTestProvider{users: map[string]*auth.User{"admin": admin, "viewer": viewer}})
	if err := app.Build(); err != nil {
		t.Fatal(err)
	}
	path := "/api/email/templates/" + template.ID + "/attachments"
	request := func(role string, size int, chunked bool) (*httptest.ResponseRecorder, *countingUpload) {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		for name, value := range map[string]string{"name": "fixture.txt", "inline": "false", "content_type": "text/plain"} {
			if err := writer.WriteField(name, value); err != nil {
				t.Fatal(err)
			}
		}
		part, err := writer.CreateFormFile("content", "fixture.txt")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(make([]byte, size)); err != nil {
			t.Fatal(err)
		}
		if err := writer.Close(); err != nil {
			t.Fatal(err)
		}
		reader := &countingUpload{Reader: bytes.NewReader(body.Bytes())}
		r := httptest.NewRequest("POST", path, reader)
		r.Header.Set("Content-Type", writer.FormDataContentType())
		r.Header.Set("X-Test-Role", role)
		if chunked {
			r.ContentLength = -1
		}
		w := httptest.NewRecorder()
		app.apiRouter.ServeHTTP(w, r)
		return w, reader
	}
	for _, tc := range []struct {
		role         string
		size, status int
	}{
		{"", 1, 401}, {"viewer", 1, 403}, {"admin", 8, 201}, {"admin", 4, 201}, {"admin", 1, 413}, {"admin", 9, 413},
	} {
		w, _ := request(tc.role, tc.size, false)
		if w.Code != tc.status {
			t.Fatalf("role=%q size=%d: HTTP%d %s", tc.role, tc.size, w.Code, w.Body.String())
		}
	}
	w, reader := request("admin", int(attachments.MaxRequestBytes()+4096), true)
	if w.Code != 413 || reader.read > attachments.MaxRequestBytes()+1 {
		t.Fatalf("unbounded chunked request: status=%d bytes=%d", w.Code, reader.read)
	}
	r := httptest.NewRequest("POST", path, bytes.NewBufferString("invalid"))
	r.Header.Set("Content-Type", "multipart/form-data; boundary=absent")
	r.Header.Set("X-Test-Role", "admin")
	w = httptest.NewRecorder()
	app.apiRouter.ServeHTTP(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("malformed multipart: %d", w.Code)
	}
	files, err := os.ReadDir(temp)
	if err != nil || len(files) != 0 {
		t.Fatalf("multipart temporary files not removed: %v", err)
	}
	var count int64
	if err := conn.Model(&models.Attachment{}).Count(&count).Error; err != nil || count != 2 {
		t.Fatalf("rejected attachment persisted: count=%d err=%v", count, err)
	}
}
