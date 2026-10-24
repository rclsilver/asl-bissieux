package chart_test

import (
	"archive/tar"
	"compress/gzip"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"sigs.k8s.io/yaml"
)

type deployment struct {
	Metadata struct{ Labels map[string]string }
	Spec     struct {
		Template struct {
			Spec struct {
				Containers []struct {
					Image string
					Env   []struct {
						Name, Value string
						ValueFrom   struct{ SecretKeyRef struct{ Name, Key string } }
					}
					VolumeMounts []struct {
						Name, MountPath string
						ReadOnly        bool
					}
				}
				Volumes []struct {
					Name   string
					Secret struct {
						SecretName  string
						DefaultMode int
						Items       []struct{ Key, Path string }
					}
				}
			}
		}
	}
}

func requireHelm(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("helm"); err != nil {
		if os.Getenv("REQUIRE_HELM") == "1" {
			t.Fatal("Helm is required in CI but is not installed")
		}
		t.Skip("Helm is not installed; lint/render/package checks were not run")
	}
}

func helm(t *testing.T, args ...string) []byte {
	t.Helper()
	output, err := exec.Command("helm", args...).CombinedOutput()
	if err != nil {
		t.Fatalf("helm %v: %v\n%s", args, err, output)
	}
	return output
}

func render(t *testing.T, chart string, values ...string) deployment {
	t.Helper()
	args := []string{"template", "test", chart, "--show-only", "templates/deployment.yaml"}
	for _, value := range values {
		args = append(args, "--set-string", value)
	}
	var d deployment
	if err := yaml.Unmarshal(helm(t, args...), &d); err != nil {
		t.Fatal(err)
	}
	if len(d.Spec.Template.Spec.Containers) != 1 {
		t.Fatal("expected exactly one application container")
	}
	return d
}

func TestSourceChartRequiresAnImageVersion(t *testing.T) {
	requireHelm(t)
	output, err := exec.Command("helm", "template", "test", ".").CombinedOutput()
	if err == nil || !strings.Contains(string(output), "image.tag or a packaged chart appVersion is required") {
		t.Fatalf("unversioned chart must fail explicitly: %v\n%s", err, output)
	}
	helm(t, "lint", "--strict", ".", "--set-string", "image.tag=0.0.0-ci")
	d := render(t, ".", "image.tag=0.0.0-ci")
	if got := d.Spec.Template.Spec.Containers[0].Image; got != "ghcr.io/rclsilver/asl-bissieux:0.0.0-ci" {
		t.Fatalf("unexpected image: %s", got)
	}
}

func TestPackagedChartUsesItsApplicationVersion(t *testing.T) {
	requireHelm(t)
	destination := t.TempDir()
	output, err := exec.Command("bash", "../dev/package-chart.sh", "v9.8.7", destination).CombinedOutput()
	if err != nil {
		t.Fatalf("package chart: %v\n%s", err, output)
	}
	archive := filepath.Join(destination, "asl-bissieux-9.8.7.tgz")
	d := render(t, archive)
	if got := d.Spec.Template.Spec.Containers[0].Image; got != "ghcr.io/rclsilver/asl-bissieux:v9.8.7" {
		t.Fatalf("packaged image is not tied to the release: %s", got)
	}
	if got := d.Metadata.Labels["app.kubernetes.io/version"]; got != "v9.8.7" {
		t.Fatalf("unexpected application version label: %q", got)
	}
	d = render(t, archive, "image.repository=registry.example.invalid/custom", "image.tag=v9.8.8")
	if got := d.Spec.Template.Spec.Containers[0].Image; got != "registry.example.invalid/custom:v9.8.8" {
		t.Fatalf("explicit image override ignored: %s", got)
	}
	file, err := os.Open(archive)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	gz, err := gzip.NewReader(file)
	if err != nil {
		t.Fatal(err)
	}
	defer gz.Close()
	reader := tar.NewReader(gz)
	for {
		header, err := reader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		if strings.HasSuffix(header.Name, "_test.go") {
			t.Fatalf("test sources leaked into the chart archive: %s", header.Name)
		}
	}
}

func TestOIDCAndOVHSecretReferences(t *testing.T) {
	requireHelm(t)
	base := []string{"image.tag=0.0.0-ci", "auth.provider=oidc", "auth.client_id=example-client", "auth.oidc.issuer=https://accounts.google.com", "auth.oidc.publicURL=https://app.example.invalid"}
	d := render(t, ".", base...)
	if len(d.Spec.Template.Spec.Volumes) != 0 {
		t.Fatal("public OIDC client must not require a confidential-client secret")
	}
	values := append(base, "auth.oidc.existingSecret=oidc-private", "auth.oidc.secretKey=oauth-secret", "mailingLists.existingSecret=ovh-private")
	d = render(t, ".", values...)
	c := d.Spec.Template.Spec.Containers[0]
	refs := make(map[string]string)
	valuesByName := make(map[string]string)
	for _, env := range c.Env {
		refs[env.Name] = env.ValueFrom.SecretKeyRef.Name + "/" + env.ValueFrom.SecretKeyRef.Key
		valuesByName[env.Name] = env.Value
	}
	for _, key := range []string{"OVH_ENDPOINT", "OVH_APPLICATION_KEY", "OVH_APPLICATION_SECRET", "OVH_CONSUMER_KEY", "APP_ML_DOMAIN", "APP_ML_MEMBERS", "APP_ML_BUREAU"} {
		if refs[key] != "ovh-private/"+key || valuesByName[key] != "" {
			t.Fatalf("%s must only reference the configured Secret", key)
		}
	}
	if valuesByName["APP_AUTH_OIDC_CLIENT_SECRET_FILE"] != "/run/secrets/asl-oidc/client-secret" || valuesByName["APP_AUTH_OIDC_PUBLIC_URL"] != "https://app.example.invalid" {
		t.Fatal("OIDC file or public URL is incorrect")
	}
	if len(c.VolumeMounts) != 1 || !c.VolumeMounts[0].ReadOnly || c.VolumeMounts[0].MountPath != "/run/secrets/asl-oidc" {
		t.Fatal("OIDC secret must be mounted read-only at the configured path")
	}
	volumes := d.Spec.Template.Spec.Volumes
	if len(volumes) != 1 {
		t.Fatal("expected one OIDC secret volume")
	}
	secret := volumes[0].Secret
	if secret.SecretName != "oidc-private" || secret.DefaultMode != 0444 || len(secret.Items) != 1 || secret.Items[0].Key != "oauth-secret" || secret.Items[0].Path != "client-secret" {
		t.Fatal("OIDC secret projection is incorrect")
	}
}

func TestOIDCRequiresItsConnectionSettings(t *testing.T) {
	requireHelm(t)
	settings := []string{"auth.oidc.issuer=https://accounts.google.com", "auth.client_id=example-client", "auth.oidc.publicURL=https://app.example.invalid"}
	for missing, setting := range settings {
		key := strings.SplitN(setting, "=", 2)[0]
		t.Run(key, func(t *testing.T) {
			args := []string{"template", "test", ".", "--set-string", "image.tag=0.0.0-ci", "--set-string", "auth.provider=oidc"}
			for i, value := range settings {
				if i != missing {
					args = append(args, "--set-string", value)
				}
			}
			output, err := exec.Command("helm", args...).CombinedOutput()
			if err == nil || !strings.Contains(string(output), key+" is required for OIDC") {
				t.Fatalf("missing OIDC setting must fail explicitly: %v\n%s", err, output)
			}
		})
	}
}
