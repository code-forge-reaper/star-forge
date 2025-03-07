import { Interpreter } from "./nova.js"
import { vfs, resolvePath, getParentDirectory } from "../../common.js";
const example = `
var x = 39
var y number = 40
var rect = {
    size: {
        width: 30
    }
}

func t()
    var g = 30
    return g
end

print("%i + %i = %i", x, y, x+y)
print(rect)
var x object = {}
print(t())
print("object: %o", rect)
try
    var y number = "tenis"
errored E
    print("an error has happened: %s",E)
end
`
function sprintf(format, ...args) {
    let argIndex = 0;
    if (args.length == 0)
        return format
    return format.replace(/%[sidfo]/g, match => {
        if (argIndex >= args.length) return match; // If not enough arguments, keep the placeholder
        let replacement = args[argIndex++];
        switch (match) {
            case "%s": return String(replacement);
            case "%i": case "%d": return parseInt(replacement, 10);
            case "%f": return parseFloat(replacement);
            case "%o": return JSON.stringify(replacement);
            default: return match;
        }
    });
}

export default function setupNova(terminal) {
    vfs.writeFile("/scripts/main.flux", example)
    terminal.registerApp("nova", "nova interpreter", (...args) => {

        let target = terminal.cwd;
        if (args.length > 0) {
            target = resolvePath(terminal.cwd, args[0]);
            // Handle ".." in path
            if (args[0] === "..") {
                target = getParentDirectory(terminal.cwd);
            }
        }
        const list = vfs.listDirectory(target);
        console.log(list)
        const filePath = resolvePath(terminal.cwd, args[0]);
        const metadata = vfs.getMetadata(filePath);
        if (!metadata) {
            terminal.echo("File not found or is not a file.");
        } else {
            const content = vfs.readFile(filePath);
            if (content === null) {
                terminal.echo("File not found or is not a file.");
            } else {
                const decoder = new TextDecoder();

                const runtime = new Interpreter(decoder.decode(content))

                runtime.globals.define('print', (...args) => {
                    terminal.echo(sprintf(...args))
                })
                runtime.interpret()

            }
        }
 
    })
    //console.log(runtime.parseBlock())
}
