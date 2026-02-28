`luaCodeWrapper(code: string)`는 **사용자 Lua 코드 실행 전에 “표준 라이브러리/브릿지/훅 디스패처”를 먼저 정의**해서, Lua 스크립트가 앱 기능을 호출할 수 있게 만들어주는 래퍼입니다. 위치는 아래입니다.

```typescript name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L1117-L1298
function luaCodeWrapper(code:string){
    return `
json = require 'json'

function getChat(id, index)
    return json.decode(getChatMain(id, index))
end

function getFullChat(id)
    return json.decode(getFullChatMain(id))
end

function setFullChat(id, value)
    setFullChatMain(id, json.encode(value))
end

function log(value)
    logMain(json.encode(value))
end

function getLoreBooks(id, search)
    return json.decode(getLoreBooksMain(id, search))
end


function loadLoreBooks(id)
    return json.decode(loadLoreBooksMain(id):await())
end

function LLM(id, prompt, useMultimodal)
    useMultimodal = useMultimodal or false
    return json.decode(LLMMain(id, json.encode(prompt), useMultimodal):await())
end

function axLLM(id, prompt, useMultimodal)
    useMultimodal = useMultimodal or false
    return json.decode(axLLMMain(id, json.encode(prompt), useMultimodal):await())
end

function getCharacterImage(id)
    return getCharacterImageMain(id):await()
end

function getPersonaImage(id)
    return getPersonaImageMain(id):await()
end

local editRequestFuncs = {}
local editDisplayFuncs = {}
local editInputFuncs = {}
local editOutputFuncs = {}

function listenEdit(type, func)
    if type == 'editRequest' then
        editRequestFuncs[#editRequestFuncs + 1] = func
        return
    end

    if type == 'editDisplay' then
        editDisplayFuncs[#editDisplayFuncs + 1] = func
        return
    end

    if type == 'editInput' then
        editInputFuncs[#editInputFuncs + 1] = func
        return
    end

    if type == 'editOutput' then
        editOutputFuncs[#editOutputFuncs + 1] = func
        return
    end

    throw('Invalid type')
end

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
        local safe, result = coroutine.resume(co, ...)

        return Promise.create(function(resolve, reject)
            local checkresult
            local step = function()
                if coroutine.status(co) == "dead" then
                    local send = safe and resolve or reject
                    return send(result)
                end

                safe, result = coroutine.resume(co)
                checkresult()
            end

            checkresult = function()
                if safe and result == Promise.resolve(result) then
                    result:finally(step)
                else
                    step()
                end
            end

            checkresult()
        end)
    end
end

callListenMain = async(function(type, id, value, meta)
    local realValue = json.decode(value)
    local realMeta = json.decode(meta)

    if type == 'editRequest' then
        for _, func in ipairs(editRequestFuncs) do
            realValue = func(id, realValue, realMeta)
        end
    end

    if type == 'editDisplay' then
        for _, func in ipairs(editDisplayFuncs) do
            realValue = func(id, realValue, realMeta)
        end
    end

    if type == 'editInput' then
        for _, func in ipairs(editInputFuncs) do
            realValue = func(id, realValue, realMeta)
        end
    end

    if type == 'editOutput' then
        for _, func in ipairs(editOutputFuncs) do
            realValue = func(id, realValue, realMeta)
        end
    end

    return json.encode(realValue)
end)

${code}
`
}
```

## 래퍼가 제공하는 것(요약)
- `json = require 'json'`: `/lua/json.lua`로 마운트된 json 모듈을 사용
- 채팅 접근 유틸:
  - `getChat(id, index)` → `getChatMain` 호출 결과를 JSON decode
  - `getFullChat(id)` / `setFullChat(id, value)`
- 로깅: `log(value)`는 JSON encode 후 `logMain`으로 전달
- 로어북:
  - `getLoreBooks(id, search)`
  - `loadLoreBooks(id)`는 Promise await 패턴 사용
- LLM 호출:
  - `LLM(id, prompt, useMultimodal)` / `axLLM(...)` (모두 JSON encode/decode + `:await()`)
- 이미지:
  - `getCharacterImage(id)` / `getPersonaImage(id)` (비동기)
- 편집 훅 리스너 시스템:
  - `listenEdit(type, func)`로 editRequest/editDisplay/editInput/editOutput에 콜백 등록
  - `callListenMain(...)`이 등록된 콜백들을 순서대로 실행하고 결과를 JSON으로 반환
- 상태 저장:
  - `getState/setState`는 `__<name>` 키로 `getChatVar/setChatVar`에 JSON으로 저장
