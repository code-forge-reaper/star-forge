// filesystem.ts

// Helper function to infer file type from file extension
export function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return "application/octet-stream"; // default binary type

  const typeMap: Record<string, string> = {
    'gif': 'image/gif',
    'png': 'image/png',
    'svg': "application/octet-stream",
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'js': 'application/javascript',
    'json': 'application/json',
    'txt': 'text/plain',
    'lua': 'text/plain',
    'flux': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    // add more mappings as needed
  };

  return typeMap[ext] || "application/octet-stream";
}

// File metadata including file type
export type FileMetadata = {
  name: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  fileType?: string;
};

// Base interface for a filesystem node
export interface FileSystemNodeBase {
  metadata: FileMetadata;
}

// Class representing a file
export class FileNode implements FileSystemNodeBase {
  type: "file" = "file";
  content: Uint8Array;
  metadata: FileMetadata;
  
  constructor(name: string, content: Uint8Array) {
    this.content = content;
    const now = new Date();
    this.metadata = {
      name,
      size: content.length,
      createdAt: now,
      updatedAt: now,
      fileType: getFileType(name),
    };
  }
  
  updateContent(content: Uint8Array) {
    this.content = content;
    this.metadata.size = content.length;
    this.metadata.updatedAt = new Date();
  }
}

// Class representing a directory
export class DirectoryNode implements FileSystemNodeBase {
  type: "directory" = "directory";
  children: Record<string, FileSystemNode>;
  metadata: FileMetadata;
  
  constructor(name: string) {
    this.children = {};
    const now = new Date();
    this.metadata = {
      name,
      size: 0,
      createdAt: now,
      updatedAt: now,
    };
  }
}

// A node can be either a file or a directory.
export type FileSystemNode = FileNode | DirectoryNode;

// The VirtualFS class that provides an in-memory filesystem
export class VirtualFS {
  private root: DirectoryNode;
  
  constructor() {
    this.root = new DirectoryNode("/");
  }
  
  // Helper: traverse a given path and return the parent directory, key (last part), and optional node.
  private _traverse(path: string): { parent: DirectoryNode; key: string; node?: FileSystemNode } | null {
    const parts = path.split("/").filter(part => part.length > 0);
    let current: DirectoryNode = this.root;
    
    if (parts.length === 0) {
      return { parent: this.root, key: "" };
    }
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const child = current.children[part];
      if (!child || child.type !== "directory") {
        return null;
      }
      current = child as DirectoryNode;
    }
    const key = parts[parts.length - 1];
    const node = current.children[key];
    return { parent: current, key, node };
  }
  
  // Create a directory (and any missing intermediate directories) at the given path.
  createDirectory(path: string): boolean {
    const parts = path.split("/").filter(part => part.length > 0);
    let current: DirectoryNode = this.root;
    
    for (let part of parts) {
      if (!current.children[part]) {
        const newDir = new DirectoryNode(part);
        current.children[part] = newDir;
        current = newDir;
      } else {
        const child = current.children[part];
        if (child.type !== "directory") {
          return false;
        }
        current = child as DirectoryNode;
      }
    }
    return true;
  }
  
  /**
   * Fetches a file from the given URL, transforms it into a data URL,
   * and writes it into the virtual filesystem at the provided path.
   *
   * This browser-based implementation uses FileReader to convert a Blob
   * (constructed from the fetched file content) into a data URL.
   *
   * @param path - The destination path in the virtual filesystem.
   * @param url - The URL of the file to fetch.
   * @returns A Promise that resolves with the data URL string of the file.
   */
  async addFile(path: string, url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
  
      // Retrieve the file as an ArrayBuffer and convert it to Uint8Array.
      const arrayBuffer = await response.arrayBuffer();
      const content = new Uint8Array(arrayBuffer);
      
      // Ensure that the parent directory exists.
      const parentPath = path.substring(0, path.lastIndexOf("/"));
      if (parentPath) {
        this.createDirectory(parentPath);
      }
      
      // Write or update the file in the virtual filesystem.
      this.writeFile(path, content);
      
      // Get the file's MIME type using extension inference.
      const fileType = getFileType(path);
  
      // Create a Blob from the content, then use FileReader to convert it into a data URL.
      const blob = new Blob([content], { type: fileType });
  
      const dataURL: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
  
        reader.onloadend = () => {
          // reader.result contains the data URL.
          resolve(reader.result as string);
        };
  
        reader.onerror = () => reject(new Error('Failed to convert Blob to data URL'));
  
        reader.readAsDataURL(blob);
      });
  
      return dataURL;
    } catch (error) {
      console.error("addFile error:", error);
      throw error;
    }
  }
  
  // Write a file. If it exists, update its content; otherwise, create a new file.
  writeFile(path: string, data: Uint8Array | string): boolean {
    const content = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const traversal = this._traverse(path);
    if (!traversal) return false;
    
    const { parent, key, node } = traversal;
    if (node) {
      if (node.type === "file") {
        (node as FileNode).updateContent(content);
        return true;
      } else {
        return false;
      }
    } else {
      parent.children[key] = new FileNode(key, content);
      return true;
    }
  }
  
  // Read a file's content as a Uint8Array.
  readFile(path: string): Uint8Array | null {
    const traversal = this._traverse(path);
    if (!traversal || !traversal.node) return null;
    if (traversal.node.type === "file") {
      return (traversal.node as FileNode).content;
    }
    return null;
  }
  
  // Delete a file or an empty directory.
  deleteNode(path: string): boolean {
    const traversal = this._traverse(path);
    if (!traversal || !traversal.node) return false;
    
    if (traversal.node.type === "directory" &&
      Object.keys((traversal.node as DirectoryNode).children).length > 0) {
      return false;
    }
    
    delete traversal.parent.children[traversal.key];
    return true;
  }
  
  // List the names of files/directories in a given directory.
  listDirectory(path: string): string[] | null {
    let dir: DirectoryNode;
    
    if (path === "/" || path === "") {
      dir = this.root;
    } else {
      const traversal = this._traverse(path);
      if (!traversal || !traversal.node || traversal.node.type !== "directory") return null;
      dir = traversal.node as DirectoryNode;
    }
    
    return Object.keys(dir.children);
  }
  
  // Retrieve metadata for a file or directory.
  getMetadata(path: string): FileMetadata | null {
    if (path === "/" || path === "") {
      return this.root.metadata;
    }
    
    const traversal = this._traverse(path);
    if (!traversal || !traversal.node) return null;
    return traversal.node.metadata;
  }
}