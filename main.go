package main

import (
	"github.com/ovh/configstore"
	"github.com/rclsilver/asl-bissieux/cmd"
)

func main() {
	configstore.InitFromEnvironment()
	cmd.Execute()
}
