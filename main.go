package main

import (
	"embed"
	"log"

	"curldesk/internal/backend"
	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

func main() {
	instance := application.New(application.Options{
		Name:        "CurlDesk",
		Description: "A local-first curl workbench",
		Icon:        appIcon,
		Services: []application.Service{
			application.NewService(&backend.WorkspaceService{}),
			application.NewService(&backend.CurlRunner{}),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{ApplicationShouldTerminateAfterLastWindowClosed: true},
	})

	instance.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "CurlDesk",
		Width: 1380, Height: 860,
		Mac:              application.MacWindow{InvisibleTitleBarHeight: 36, Backdrop: application.MacBackdropTranslucent, TitleBar: application.MacTitleBarHiddenInset},
		BackgroundColour: application.NewRGB(17, 18, 20),
		URL:              "/",
	})

	if err := instance.Run(); err != nil {
		log.Fatal(err)
	}
}
