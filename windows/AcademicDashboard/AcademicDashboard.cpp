// AcademicDashboard.cpp : Defines the entry point for the application.
//

#include "pch.h"
#include "AcademicDashboard.h"

#include "AutolinkedNativeModules.g.h"

#include "NativeModules.h"
#include "WorkspaceFiles.h"
#include <dwmapi.h>

// A PackageProvider containing any turbo modules you define within this app project
struct CompReactPackageProvider
    : winrt::implements<CompReactPackageProvider, winrt::Microsoft::ReactNative::IReactPackageProvider> {
 public: // IReactPackageProvider
  void CreatePackage(winrt::Microsoft::ReactNative::IReactPackageBuilder const &packageBuilder) noexcept {
    AddAttributedModules(packageBuilder, true);
  }
};

// The entry point of the Win32 application
_Use_decl_annotations_ int CALLBACK WinMain(HINSTANCE instance, HINSTANCE, PSTR /* commandLine */, int showCmd) {
  // Initialize WinRT
  winrt::init_apartment(winrt::apartment_type::single_threaded);

  // A single writer prevents separate app instances from overwriting local changes.
  winrt::handle instanceMutex(CreateMutexW(nullptr, FALSE, L"Local\\AcademicDashboard.Workspace"));
  if (!instanceMutex || GetLastError() == ERROR_ALREADY_EXISTS) {
    MessageBoxW(nullptr, L"Academic Dashboard is already running.", L"Academic Dashboard", MB_OK | MB_ICONINFORMATION);
    return 0;
  }

  // Enable per monitor DPI scaling
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

  // Find the path hosting the app exe file
  WCHAR appDirectory[MAX_PATH];
  GetModuleFileNameW(NULL, appDirectory, MAX_PATH);
  PathCchRemoveFileSpec(appDirectory, MAX_PATH);

  // Create a ReactNativeWin32App with the ReactNativeAppBuilder
  auto reactNativeWin32App{winrt::Microsoft::ReactNative::ReactNativeAppBuilder().Build()};

  // Configure the initial InstanceSettings for the app's ReactNativeHost
  auto settings{reactNativeWin32App.ReactNativeHost().InstanceSettings()};
  // Register any autolinked native modules
  RegisterAutolinkedNativeModulePackages(settings.PackageProviders());
  // Register any native modules defined within this app project
  settings.PackageProviders().Append(winrt::make<CompReactPackageProvider>());

#if BUNDLE
  // Load the JS bundle from a file (not Metro):
  // Set the path (on disk) where the .bundle file is located
  settings.BundleRootPath(std::wstring(L"file://").append(appDirectory).append(L"\\Bundle\\").c_str());
  // Set the name of the bundle file (without the .bundle extension)
  settings.JavaScriptBundleFile(L"index.windows");
  // Disable hot reload
  settings.UseFastRefresh(false);
#else
  // Load the JS bundle from Metro
  settings.JavaScriptBundleFile(L"index");
  // Enable hot reload
  settings.UseFastRefresh(true);
#endif
#if _DEBUG
  // For Debug builds
  // Enable Direct Debugging of JS
  settings.UseDirectDebugger(true);
  // Enable the Developer Menu
  settings.UseDeveloperSupport(true);
#else
  // For Release builds:
  // Disable Direct Debugging of JS
  settings.UseDirectDebugger(false);
  // Disable the Developer Menu
  settings.UseDeveloperSupport(false);
#endif

  // Get the AppWindow so we can configure its initial title and size
  auto appWindow{reactNativeWin32App.AppWindow()};
  appWindow.Title(L"Academic Dashboard");
  DashboardStorage::owner = winrt::Microsoft::UI::GetWindowFromWindowId(appWindow.Id());
  const double scale = GetDpiForWindow(DashboardStorage::owner) / 96.0;
  MONITORINFO monitor{sizeof(MONITORINFO)};
  GetMonitorInfoW(MonitorFromWindow(DashboardStorage::owner, MONITOR_DEFAULTTONEAREST), &monitor);
  appWindow.Resize({std::min(static_cast<int>(1320 * scale), static_cast<int>(monitor.rcWork.right - monitor.rcWork.left - 40)),
                    std::min(static_cast<int>(920 * scale), static_cast<int>(monitor.rcWork.bottom - monitor.rcWork.top - 40))});
  const BOOL darkTitleBar = TRUE;
  DwmSetWindowAttribute(DashboardStorage::owner, 20, &darkTitleBar, sizeof(darkTitleBar));

  // Get the ReactViewOptions so we can set the initial RN component to load
  auto viewOptions{reactNativeWin32App.ReactViewOptions()};
  viewOptions.ComponentName(L"AcademicDashboard");

  // Start the app
  reactNativeWin32App.Start();
  return 0;
}
