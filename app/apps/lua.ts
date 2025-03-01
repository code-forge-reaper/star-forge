import wasmoon from "wasmoon"
const factory = new wasmoon.LuaFactory("node_modules/wasmoon/dist/glue.wasm")
var lua = await factory.createEngine()
var LUA_MODULE = await factory.getLuaModule() // this is only needed/created once, we only need it so apps don't turn async, preventing Run-After-Exit
async function reloadLua(term){
    lua = await factory.createEngine()
    lua.global.set("print", term.echo)
}

export default function setup(terminal){
    lua.global.set("print", terminal.echo)

    terminal.createFile("/main.lua", "print('this is a simple test')")
    terminal.registerApp("lua", "the lua interpreter", (...args)=>{
        let g = []
        for(let arg of args){
            if(arg.startsWith("--")){
                arg = arg.slice(2)
                switch(arg){
                    case "version":{
                        terminal.echo("lua applet V0.1")
                        break
                    }
                    default:
                    {

                        terminal.echo(`unknown option: ${arg}`)
                        return 1
                    }
                }
            }else{
                g.push(arg)
            }
        }
        lua.global.set("arg", g)
        const FILES = terminal.GET_CDIR_FILES()
        console.log(g, FILES)
        for(let file of Object.keys(FILES)){
            if(typeof FILES[file] == "string"){
                factory.mountFileSync(LUA_MODULE, file, FILES[file])
            }
        }
        lua.doFileSync(g[0])
        lua.global.close() // in C, this is how you'd generaly avoid memory errors :)
        reloadLua(terminal)

    })
}
