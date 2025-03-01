// filesystem.ts
export let FS: any = {
  "/": {
    Desktop: {
      "README.md": "This is a sample desktop file",
    },
    docs: {
      "example.txt": "this is a simple file system test",
    },
  },
};

export let cDir: string[] = ["/"];

// --- FS Change Callbacks ---
let fsChangeCallbacks: (() => void)[] = [];

export function subscribeToFSChanges(callback: () => void) {
  fsChangeCallbacks.push(callback);
}

export function unsubscribeFromFSChanges(callback: () => void) {
  const index = fsChangeCallbacks.indexOf(callback);
  if (index >= 0) fsChangeCallbacks.splice(index, 1);
}
export
  function notifyFSChange() {
  for (const callback of fsChangeCallbacks) {
    callback();
  }
}

// --- Filesystem Helper Functions ---
export function setCDir(newCDir: string[]) {
  cDir = newCDir;
}

export function resolvePath(input: string, currentDir: string[]): string[] {
  let result: string[];
  if (input.startsWith("/")) {
    result = ["/"];
  } else {
    result = currentDir.slice();
  }
  const tokens = input.split("/").filter((token) => token.length > 0);
  for (let token of tokens) {
    if (token === ".") continue;
    if (token === "..") {
      if (result.length > 1) result.pop();
    } else {
      result.push(token);
    }
  }
  return result;
}

export function getFSObject(pathArr: string[]): any {
  let node = FS;
  for (let segment of pathArr) {
    if (typeof node === "object" && node !== null && segment in node) {
      node = node[segment];
    } else {
      return undefined;
    }
  }
  return node;
}

export function createFile(path: string, content: string): void {
  const resolvedPath = resolvePath(path, cDir);
  if (resolvedPath.length <= 1) {
    console.error("Invalid file path");
    return;
  }
  const parentPath = resolvedPath.slice(0, resolvedPath.length - 1);
  const fileName = resolvedPath[resolvedPath.length - 1];
  const parent = getFSObject(parentPath);
  if (parent === undefined) {
    throw new Error("Cannot create file: parent directory does not exist");
    return;
  }
  if (typeof parent !== "object") {
    throw new Error("Cannot create file: parent is not a directory");
    return;
  }
  if (fileName in parent && typeof parent[fileName] === "object") {
    throw new Error("Cannot overwrite directory: " + fileName);
    return;
  }
  parent[fileName] = content;
  notifyFSChange();
}
export type TypeReturn = "directory" | "file"

export function GetType(nodeID: string): TypeReturn | "not found" {
  const resolvedPath = resolvePath(nodeID, cDir);
  const node = getFSObject(resolvedPath);

  if (node === undefined) {
    return "not found";
  }

  return typeof node === "object" ? "directory" : "file";
}


export function GET_CDIR_FILES() {
  return getFSObject(cDir);
}
