import {Interpreter} from "./nova.js"
const example=`
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
    if(args.length ==0)
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

export default function setup(terminal){
    terminal.createFile("main.flux", example)
    terminal.registerApp("nova", "NovaScript/Flux V3 interpreter",(...args)=>{
        const FILES = terminal.GET_CDIR_FILES()
        let content = FILES[args[0]]
        if(!content)
            return 1
        const runtime = new Interpreter(content)
        runtime.globals.define('print', (...args)=>{
            terminal.echo(sprintf(...args))
        })
        runtime.interpret()
    })
    //console.log(runtime.parseBlock())
}
