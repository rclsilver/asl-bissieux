package cmd

import (
	"fmt"
	"os"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"github.com/rclsilver/asl-bissieux/pkg/config"
	"github.com/rclsilver/asl-bissieux/version"
)

var (
	verbose bool
)

var rootCmd = &cobra.Command{
	Use:     "asl-bissieux",
	Short:   "asl-bissieux server",
	Version: fmt.Sprintf("%s (commit %s)", version.Version, version.Commit),
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		if verbose {
			logrus.SetLevel(logrus.DebugLevel)
		}

		if err := config.Load(); err != nil {
			logrus.WithError(err).Fatalf("unable to load the configuration")
		}
	},
}

func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

func init() {
	config.SetFlags(rootCmd.PersistentFlags())

	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable to verbose mode")
}
