Risuai에서 **Lua 스크립트(트리거/편집 훅 등)를 로드·실행·관리**하는 핵심은 거의 전부 `src/ts/process/scriptings.ts`에 모여 있습니다. 큰 흐름은 **(1) Lua 런타임 준비(LuaFactory) → (2) 스크립트 코드 주입(doString) → (3) 정해진 엔트리포인트 함수 호출(onInput/onOutput/…)** 구조입니다.

---

## 1) Lua 런타임/표준 라이브러리 로딩: `makeLuaFactory()` / `ensureLuaFactory()`

- `LuaFactory`를 만들고, `/lua/<파일명>`을 fetch해서 런타임에 마운트합니다.
- 현재 스니펫 기준으로 `json.lua`를 기본으로 올립니다. (Lua 코드에서 `json.decode/encode`를 쓰는 부분이 있어서 필수로 보입니다)
- `ensureLuaFactory()`는 동시 호출을 막기 위해 `luaFactoryPromise`로 **1회만 초기화**되도록 보장합니다.

```typescript name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L1077-L1115
async function makeLuaFactory(){
    const _luaFactory = new LuaFactory()
    async function mountFile(name:string){
        let code = ''
        for(let i = 0; i < 3; i++){
            try {
                const res = await fetch('/lua/' + name)
                if(res.status >= 200 && res.status < 300){
                    code = await res.text()
                    break
                }
            } catch (error) {}
        }
        await _luaFactory.mountFile(name,code)
    }

    await mountFile('json.lua')
    luaFactory = _luaFactory
}

async function ensureLuaFactory() {
    if (luaFactory) return;
    /* ... promise guard ... */
}
```

---

## 2) Lua 코드 실행의 중심: `runScripted(...)`

`runScripted(code, { type:'lua'|'py', mode, ... })`가 스크립팅 실행의 단일 진입점입니다.

- 기본 `type`은 `'lua'`
- type이 lua면 먼저 `ensureLuaFactory()`로 런타임 준비
- 그 후 엔진 상태(`ScriptingEngineState`)를 준비하고,
- **코드를 `luaCodeWrapper(code)`로 감싼 뒤** `engine.doString(...)`로 주입합니다.

```typescript name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L63-L77
export async function runScripted(code:string, arg:{ /* ... */ type?: 'lua'|'py' }){
    const type: 'lua'|'py' = arg.type ?? 'lua'
    /* ... */
    if(type === 'lua'){
        await ensureLuaFactory()
    }
    /* ... */
}
```

```typescript name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L946-L963
console.log('Running Lua code:', code)
if(ScriptingEngineState.type === 'lua'){
    await ScriptingEngineState.engine?.doString(luaCodeWrapper(code))
}
```

---

## 3) Lua에서 호출되는 “엔트리포인트(훅)” 관리: `mode` 기반 함수 호출

`runScripted`는 `mode`에 따라 Lua 글로벌 함수들을 찾아 호출합니다.

- `input` → `onInput(accessKey)`
- `output` → `onOutput(accessKey)`
- `start` → `onStart(accessKey)`
- `onButtonClick` → `onButtonClick(accessKey, data)`
- `editDisplay/editInput/editOutput` 등 → `callListenMain(mode, accessKey, dataJson, metaJson)` 형태

```typescript name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L964-L1034
if(ScriptingEngineState.type === 'lua'){
    const luaEngine = ScriptingEngineState.engine
    try {
        switch(mode){
            case 'input':{
                const func = luaEngine.global.get('onInput')
                if(func){ res = await func(accessKey) }
                break
            }
            case 'output':{
                const func = luaEngine.global.get('onOutput')
                if(func){ res = await func(accessKey) }
                break
            }
            case 'start':{
                const func = luaEngine.global.get('onStart')
                if(func){ res = await func(accessKey) }
                break
            }
            case 'onButtonClick':{
                const func = luaEngine.global.get('onButtonClick')
                if(func){ res = await func(accessKey, data) }
                break
            }
            case 'editDisplay':
            case 'editInput':
            case 'editOutput':{
                const func = luaEngine.global.get('callListenMain')
                if(func){
                    res = await func(mode, accessKey, JSON.stringify(data), JSON.stringify(meta))
                    res = JSON.parse(res)
                }
                break
            }
            default:{
                const func = luaEngine.global.get(mode)
                if(func){ res = await func(accessKey) }
                break
            }
        }
        if(res === false){ stopSending = true }
    } catch (error) {
        console.error(error)
    }
}
```

이 구조 때문에 “Lua 스크립트를 관리한다”는 것은 결국:
- 어떤 `mode`가 언제 호출되는지,
- Lua 코드가 해당 글로벌 함수를 정의했는지,
- 그리고 wrapper가 어떤 헬퍼/브릿지를 제공하는지가 핵심입니다.

---

## 4) Lua 코드 wrapper에서 제공하는 상태/리스너 관리 (`luaCodeWrapper`)

`luaCodeWrapper(code)` 안에는 Lua 측에서 쓰는 유틸이 들어갑니다. 예를 들면:

- `getState/setState` : 내부적으로 `getChatVar/setChatVar` + JSON으로 상태 저장
- `async(...)` : coroutine + Promise 브릿지
- `listenEdit(type, func)` : editRequest/editDisplay/editInput/editOutput 리스너 등록
- `callListenMain = async(function(...) ... end)` : 등록된 리스너들을 실행하는 메인 디스패처(추정)

```typescript name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L1185-L1222
local editRequestFuncs = {}
local editDisplayFuncs = {}
local editInputFuncs = {}
local editOutputFuncs = {}

function listenEdit(type, func)
    if type == 'editRequest' then
        editRequestFuncs[#editRequestFuncs + 1] = func
        return
    end
    /* ... */
end
```

```typescript name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L1224-L1264
function getState(id, name)
    local escapedName = "__"..name
    return json.decode(getChatVar(id, escapedName))
end

function setState(id, name, value)
    local escapedName = "__"..name
    setChatVar(id, escapedName, json.encode(value))
end

function async(callback)
    return function(...)
        local co = coroutine.create(callback)
        /* ... Promise bridge ... */
    end
end

callListenMain = async(function(type, id, value, meta)
```

---

## 5) “어떤 Lua를 실행할지”를 고르는 부분: 트리거 연결

캐릭터/모듈에 등록된 트리거 중 `effect[0].type === 'triggerlua'`인 경우 `runScripted(trigger.effect[0].code, ...)`로 실행합니다.

- 편집 훅(editInput/editOutput/editDisplay)용: `runLuaEditTrigger`
- 버튼 클릭용: `runLuaButtonTrigger`

```typescript name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L1300-L1330
export async function runLuaEditTrigger<T extends string|OpenAIChat[]>(char, mode, content, meta?){
    /* mode normalize ... */
    const triggers = char.type === 'group'
      ? (getModuleTriggers())
      : (char.triggerscript.map((v) => { v.lowLevelAccess = false; return v }).concat(getModuleTriggers()))

    for(let trigger of triggers){
        if(trigger?.effect?.[0]?.type === 'triggerlua'){
            const runResult = await runScripted(trigger.effect[0].code, { mode, data, meta })
            /* ... */
        }
    }
}
```

```typescript name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L1342-L1364
export async function runLuaButtonTrigger(char, data){
    const triggers = char.type === 'group' ? getModuleTriggers() : char.triggerscript /* ... */.concat(getModuleTriggers())
    for(let trigger of triggers){
        if(trigger?.effect?.[0]?.type === 'triggerlua'){
            runResult = await runScripted(trigger.effect[0].code, { mode: 'onButtonClick', data })
        }
    }
}
```

---

## 6) “Lua 스크립트 저장/조회” (모듈 단위): `ModuleHandler` (MCP)

Lua를 “실행”하는 쪽은 `scriptings.ts`가 중심이고, “모듈에 들어있는 Lua 스크립트를 저장/조회”하는 관리 API는 MCP 도구 핸들러 쪽에 있습니다.

```typescript name=src/ts/process/mcp/risuaccess/modules.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/mcp/risuaccess/modules.ts#L743-L843
export class ModuleHandler extends MCPToolHandler {
  async getModuleLuaScript(id: string): Promise<RPCToolCallContent[]> { /* ... */ }
  async setModuleLuaScript(id: string, code: string): Promise<RPCToolCallContent[]> { /* ... */ }
}
```