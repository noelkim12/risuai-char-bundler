레포 내부 검색 기준으로는 `LuaFactory` / `LuaEngine` **구현이 Risuai 코드에 존재하지 않고**, `src/ts/process/scriptings.ts`에서 **타입/클래스를 “외부에서 가져다 쓰는 형태”**로만 보입니다. 즉, Lua 엔진은 프로젝트 내부 구현체가 아니라 **외부 라이브러리(또는 번들에 포함되는 런타임 모듈)**에서 제공되는 것으로 보입니다.

또한 제가 사용한 코드 검색 결과는 상위 일부만 보여줄 수 있어서(검색 도구 제한) 누락이 있을 수 있습니다. 전체 검색은 GitHub UI에서 확인할 수 있습니다:  
https://github.com/kwaroran/Risuai/search?q=LuaFactory&type=code  
https://github.com/kwaroran/Risuai/search?q=LuaEngine&type=code

아래는 **확인된 초기화/사용 방식(프로젝트 내부 로직)**입니다.

---

## 1) LuaFactory/LuaEngine는 어디서 오나?

- `scriptings.ts` 내에서 `new LuaFactory()`를 호출하고 `LuaEngine` 타입을 사용하지만,
- 레포 전체에서 `class LuaFactory` / `interface LuaEngine` 정의가 검색되지 않았습니다(=외부 의존).

`package.json`에 “lua”라는 이름이 명시적으로 들어간 의존성은 제가 확인한 구간에는 보이지 않았지만, 전체 dependencies가 길어서(58줄 이후) 거기에 있을 수도 있고, 혹은 **번들된 로컬 모듈/별도 파일**에서 타입만 노출되는 구조일 수도 있습니다.

---

## 2) 초기화 방식: “LuaFactory 싱글톤 + 표준 Lua 파일 마운트”

Lua 런타임 준비는 `ensureLuaFactory()` → `makeLuaFactory()` 순으로 진행됩니다.

핵심 포인트:
- `luaFactory`는 모듈 전역 변수로 **싱글톤처럼 유지**
- 동시에 여러 곳에서 실행을 요청해도 한 번만 초기화되도록 `luaFactoryPromise`로 가드
- `/lua/json.lua`를 fetch해서 `_luaFactory.mountFile('json.lua', code)`로 마운트

```typescript name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L16-L44
let luaFactory:LuaFactory
let luaFactoryPromise: Promise<void> | null = null;
```

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
```

---

## 3) 엔진 생성 방식: mode별 LuaEngine 생성 + injectObjects 옵션

실제 Lua VM(엔진 컨텍스트)은 `runScripted()`에서 “모드별”로 관리됩니다.

- `ScriptingEngines: Map<string, ScriptingEngineState>`에 `mode`(예: `input`, `output`, `editDisplay` 등) 별 상태를 저장
- 코드가 바뀌면 기존 엔진을 닫고(`engine?.global.close()`), 새 엔진을 생성
- 새 엔진은 `luaFactory.createEngine({ injectObjects: true })`로 생성
- 이후 JS 함수들을 `luaEngine.global.set(name, func)`로 Lua 글로벌에 주입

```typescript name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L16-L101
interface LuaScriptingEngineState extends BasicScriptingEngineState {
    engine?: LuaEngine;
    type: 'lua';
}
```

```typescript name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L16-L101
let ScriptingEngines = new Map<string, ScriptingEngineState>()
```

```typescript name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L16-L101
if(ScriptingEngineState.type === 'lua'){
    console.log('Creating new Lua engine for mode:', mode)
    ScriptingEngineState.engine?.global.close()
    ScriptingEngineState.code = code
    ScriptingEngineState.engine = await luaFactory.createEngine({injectObjects: true})
    const luaEngine = ScriptingEngineState.engine
    declareAPI = (name:string, func:Function) => {
        luaEngine.global.set(name, func)
    }
}
```

---

## 4) 코드 주입 방식: luaCodeWrapper로 감싸 doString 실행

엔진이 준비되면, Lua 실행 문자열은:

- `luaCodeWrapper(code)`로 **json require / helper / async 브릿지 / callListenMain** 등을 먼저 선언하고
- 마지막에 `${code}`를 붙여서
- `engine.doString(...)`로 로드/실행합니다.

```typescript name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L946-L963
if(ScriptingEngineState.type === 'lua'){
    await ScriptingEngineState.engine?.doString(luaCodeWrapper(code))
}
```