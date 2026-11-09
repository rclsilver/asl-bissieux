package version

var (
	// Overridden at build time by the Makefile; go run keeps explicit development values.
	Version = "dev"
	Commit  = "unknown"
)
