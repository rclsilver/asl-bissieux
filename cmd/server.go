package cmd

import (
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/db"
	"github.com/rclsilver/asl-bissieux/server"
)

var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "Starts the server",
	Run: func(cmd *cobra.Command, args []string) {
		if err := db.InitDB(); err != nil {
			logrus.WithError(err).Fatal("unable to initialize the database")
		}

		authProvider, err := auth.GetProvider()
		if err != nil {
			logrus.WithError(err).Fatal("unable to get authentication provider")
		}

		server := server.NewServer().
			WithAuthProvider(authProvider)

		if err := server.Build(); err != nil {
			logrus.WithError(err).Fatal("unable to build server")
		}

		if err := server.Serve(); err != nil {
			logrus.WithError(err).Fatal("unable to start server")
		}
	},
}

func init() {
	rootCmd.AddCommand(serverCmd)
}
