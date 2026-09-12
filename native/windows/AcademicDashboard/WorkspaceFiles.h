#pragma once
#include <NativeModules.h>
#include <shobjidl.h>
#include <filesystem>
#include <fstream>
#include <thread>

namespace DashboardStorage {
inline HWND owner = nullptr;
inline std::wstring Environment(const wchar_t *name) {
  const DWORD size = GetEnvironmentVariableW(name, nullptr, 0);
  if (!size) return {};
  std::wstring result(size, L'\0');
  result.resize(GetEnvironmentVariableW(name, result.data(), size));
  return result;
}
inline std::filesystem::path FilePath() {
  const auto overridePath = Environment(L"ACADEMIC_DASHBOARD_DATA_DIR");
  if (!overridePath.empty()) return std::filesystem::path(overridePath) / L"workspace.json";
  const auto local = Environment(L"LOCALAPPDATA");
  if (local.empty()) throw std::runtime_error("LOCALAPPDATA is unavailable.");
  return std::filesystem::path(local) / L"AcademicDashboard" / L"workspace.json";
}
inline std::string ReadText(const std::filesystem::path &path, uintmax_t limit) {
  const auto size = std::filesystem::file_size(path);
  if (size > limit) throw std::runtime_error("File exceeds the supported size limit.");
  std::ifstream input(path, std::ios::binary);
  if (!input) throw std::runtime_error("Could not open the selected file.");
  std::string result(static_cast<size_t>(size), '\0');
  if (size && !input.read(result.data(), static_cast<std::streamsize>(size))) throw std::runtime_error("Could not read the complete file.");
  if (result.starts_with("\xEF\xBB\xBF")) result.erase(0, 3);
  return result;
}
// Same-volume replacement preserves the previous file if writing or flushing fails.
inline void WriteText(const std::filesystem::path &path, const std::string &text) {
  if (text.size() > 64 * 1024 * 1024) throw std::runtime_error("Workspace exceeds 64 MB. Export a backup before reducing older records.");
  std::filesystem::create_directories(path.parent_path());
  const auto temp = std::filesystem::path(path.wstring() + L".writing");
  try {
    winrt::handle output(CreateFileW(temp.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr));
    if (!output) winrt::throw_last_error();
    DWORD written = 0;
    winrt::check_bool(WriteFile(output.get(), text.data(), static_cast<DWORD>(text.size()), &written, nullptr));
    if (written != text.size()) throw std::runtime_error("Disk write was incomplete.");
    winrt::check_bool(FlushFileBuffers(output.get()));
    output.close();
    winrt::check_bool(MoveFileExW(temp.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH));
  } catch (...) {DeleteFileW(temp.c_str()); throw;}
}
template <typename T, typename F> void Guard(const winrt::Microsoft::ReactNative::ReactPromise<T> &promise, F action) noexcept {
  try {action();}
  catch (const winrt::hresult_error &error) {promise.Reject(error.message().c_str());}
  catch (const std::exception &error) {promise.Reject(error.what());}
  catch (...) {promise.Reject("The file operation failed.");}
}
inline std::filesystem::path SelectedPath(IFileDialog *dialog) {
  winrt::com_ptr<IShellItem> item;
  winrt::check_hresult(dialog->GetResult(item.put()));
  PWSTR name = nullptr;
  winrt::check_hresult(item->GetDisplayName(SIGDN_FILESYSPATH, &name));
  std::filesystem::path result(name); CoTaskMemFree(name); return result;
}
}

REACT_MODULE(WorkspaceFiles)
struct WorkspaceFiles {
  winrt::Microsoft::ReactNative::ReactContext context;
  REACT_INIT(Initialize)
  void Initialize(winrt::Microsoft::ReactNative::ReactContext const &value) noexcept {context = value;}

  REACT_SYNC_METHOD(NewId)
  std::string NewId() noexcept {GUID id{}; if (FAILED(CoCreateGuid(&id))) std::terminate(); return winrt::to_string(winrt::to_hstring(id));}
  REACT_SYNC_METHOD(StoragePath)
  std::string StoragePath() noexcept {try {return winrt::to_string(DashboardStorage::FilePath().wstring());} catch (...) {return "Local storage unavailable";}}

  REACT_METHOD(Read)
  void Read(winrt::Microsoft::ReactNative::ReactPromise<std::string> promise) noexcept {
    std::thread([promise] {DashboardStorage::Guard(promise, [&] {const auto path = DashboardStorage::FilePath(); promise.Resolve(std::filesystem::exists(path) ? DashboardStorage::ReadText(path, 64 * 1024 * 1024) : "");});}).detach();
  }
  REACT_METHOD(Write)
  void Write(std::string text, winrt::Microsoft::ReactNative::ReactPromise<void> promise) noexcept {
    std::thread([promise, text = std::move(text)] {DashboardStorage::Guard(promise, [&] {DashboardStorage::WriteText(DashboardStorage::FilePath(), text); promise.Resolve();});}).detach();
  }
  REACT_METHOD(PickImport)
  void PickImport(winrt::Microsoft::ReactNative::ReactPromise<winrt::Microsoft::ReactNative::JSValue> promise) noexcept {
    context.UIDispatcher().Post([promise] {DashboardStorage::Guard(promise, [&] {
      winrt::com_ptr<IFileOpenDialog> dialog;
      winrt::check_hresult(CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(dialog.put())));
      const COMDLG_FILTERSPEC filters[] = {{L"Dashboard imports", L"*.json;*.csv;*.md;*.txt"}, {L"All files", L"*.*"}};
      winrt::check_hresult(dialog->SetFileTypes(2, filters));
      winrt::check_hresult(dialog->SetOptions(FOS_FORCEFILESYSTEM | FOS_FILEMUSTEXIST | FOS_PATHMUSTEXIST | FOS_NOCHANGEDIR));
      dialog->SetTitle(L"Import dashboard data");
      const auto result = dialog->Show(DashboardStorage::owner);
      if (result == HRESULT_FROM_WIN32(ERROR_CANCELLED)) {promise.Resolve(nullptr); return;}
      winrt::check_hresult(result);
      const auto path = DashboardStorage::SelectedPath(dialog.get());
      std::thread([promise, path] {DashboardStorage::Guard(promise, [&] {
        promise.Resolve(winrt::Microsoft::ReactNative::JSValueObject{{"name", winrt::to_string(path.filename().wstring())}, {"text", DashboardStorage::ReadText(path, 64 * 1024 * 1024)}});
      });}).detach();
    });});
  }
  REACT_METHOD(Export)
  void Export(std::string name, std::string text, winrt::Microsoft::ReactNative::ReactPromise<bool> promise) noexcept {
    context.UIDispatcher().Post([promise, name = std::move(name), text = std::move(text)] {DashboardStorage::Guard(promise, [&] {
      winrt::com_ptr<IFileSaveDialog> dialog;
      winrt::check_hresult(CoCreateInstance(CLSID_FileSaveDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(dialog.put())));
      const COMDLG_FILTERSPEC filters[] = {{L"Dashboard backup", L"*.json"}};
      winrt::check_hresult(dialog->SetFileTypes(1, filters));
      winrt::check_hresult(dialog->SetOptions(FOS_FORCEFILESYSTEM | FOS_OVERWRITEPROMPT | FOS_PATHMUSTEXIST | FOS_NOCHANGEDIR));
      dialog->SetDefaultExtension(L"json"); dialog->SetFileName(winrt::to_hstring(name).c_str());
      const auto result = dialog->Show(DashboardStorage::owner);
      if (result == HRESULT_FROM_WIN32(ERROR_CANCELLED)) {promise.Resolve(false); return;}
      winrt::check_hresult(result);
      const auto path = DashboardStorage::SelectedPath(dialog.get());
      if (path == DashboardStorage::FilePath()) throw std::runtime_error("Choose a backup destination separate from the live workspace file.");
      std::thread([promise, path, text] {DashboardStorage::Guard(promise, [&] {DashboardStorage::WriteText(path, text); promise.Resolve(true);});}).detach();
    });});
  }
};
