import {useCallback, useEffect, useState} from "react";
import {emptyDatabase, type InternshipDatabase} from "./model";
import {INTERNSHIP_STORAGE_KEY, internshipRepository} from "./storage";

function loadLocal(): {database: InternshipDatabase; error: string; blocked: boolean} {
  try { return {database: internshipRepository(window.localStorage).load(), error: "", blocked: false}; }
  catch { return {database: emptyDatabase(), error: "Saved internship data could not be read. Your existing data has been left untouched. Export the recovery file and check browser storage access before retrying.", blocked: true}; }
}
export function useInternships() {
  const [state, setState] = useState(loadLocal);
  const [notice, setNotice] = useState("");
  const reload = useCallback(() => setState(loadLocal()), []);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === INTERNSHIP_STORAGE_KEY || event.key === null) reload(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [reload]);
  const commit = useCallback((database: InternshipDatabase): boolean => {
    if (state.blocked) return false;
    try {
      internshipRepository(window.localStorage).save(database);
      setState({database, error: "", blocked: false});
      return true;
    } catch {
      setState(current => ({...current, error: "Could not save this change locally. Browser storage may be full or unavailable. Export a backup, free space, and try again."}));
      return false;
    }
  }, [state.blocked]);
  return {...state, commit, reload, notice, setNotice};
}
export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], {type: "application/json"}));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
