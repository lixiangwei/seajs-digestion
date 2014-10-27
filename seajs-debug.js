/*** 
   Sea.js 3.0.0 | seajs.org/LICENSE.md
   中文注释由 李祥威 添加，为个人对细节的理解，官方解释很详细的地方就不说了
   难免有错漏，联系我： chuangweili@163.com
*/
(function(global, undefined) {

// Avoid conflicting when `sea.js` is loaded multiple times
//global指的是当前环境全局变量，浏览器上是window，nodejs是global
if (global.seajs) {
  return
}

//创建seajs对象,并且拓展到当前全局对象上,后面会在这上面添加许多属性方法
var seajs = global.seajs = {
  // The current version of Sea.js being used
  version: "3.0.0"
}

//创建数据属性对象
var data = seajs.data = {}


/**
 * util-lang.js - The minimal language enhancement
 */

//和zepto一样，也是使用Object的toString方法进行类型判断
//避免使用instanceof判断时，跨frame问题，也就是不同的frame各自的对象，不共用，如 arr1 instanceof Array 如果arr1 和 Array来自不同frame会返回false
//同时可以判断一个对象是原生的还是开发者定义的，例如是否为原生JSON对象，不是原生的返回 “[object Object]”，是原生返回“[object JSON]”
function isType(type) {
  return function(obj) {
    return {}.toString.call(obj) == "[object " + type + "]"
  }
}

var isObject = isType("Object")
var isString = isType("String")
var isArray = Array.isArray || isType("Array")
var isFunction = isType("Function")

//生成一个当前id
var _cid = 0
function cid() {
  return _cid++
}


/**
 * util-events.js - The minimal events support
 */
 
//定制事件对象
var events = data.events = {}

// Bind event
seajs.on = function(name, callback) {
//绑定事件到定制的事件对象上，首先查看要添加的事件类型之前是否存在，有的话把当前回调添加到该事件回调数组上去。没有的话新建该事件的回调数组。
  var list = events[name] || (events[name] = [])
  list.push(callback)
  return seajs
}

// Remove event. If `callback` is undefined, remove all callbacks for the
// event. If `event` and `callback` are both undefined, remove all callbacks
// for all events
seajs.off = function(name, callback) {
  // Remove *all* events
  if (!(name || callback)) {
//当name和callback都为falsy值的时候清除所有事件监听，通过指向一个新创建的对象
    events = data.events = {}
    return seajs
  }

  var list = events[name]
  if (list) {
    if (callback) {
//有name有callback，则遍历事件监听数组删除对应callback
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i] === callback) {
//直接切掉，如果delete数组项的话会留下undefined
          list.splice(i, 1)
        }
      }
    }
//有name没有callback的情况
    else {
      delete events[name]
    }
  }

  return seajs
}

// Emit event, firing all bound callbacks. Callbacks receive the same
// arguments as `emit` does, apart from the event name
//触发指定事件上的回调
var emit = seajs.emit = function(name, data) {
  var list = events[name]

  if (list) {
    // Copy callback lists to prevent modification   因为slice返回一个新数组
    list = list.slice()

    // Execute event callbacks, use index because it's the faster.
//这样循环调用比起用for-in 要快，事实上for，while，do-while基本上都比for-in快
    for(var i = 0, len = list.length; i < len; i++) {
      list[i](data)
    }
  }

  return seajs
}

/**
 * util-path.js - The utilities for operating path such as id, uri
 */

//匹配路径，非?#的字符/结尾
var DIRNAME_RE = /[^?#]*\//

//匹配  /./
var DOT_RE = /\/\.\//g
//匹配两个点，条件： /任意非斜线字符/../
var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//
//匹配多条斜线，且不能以:开头
var MULTI_SLASH_RE = /([^:/])\/+\//g

// Extract the directory portion of a path
// dirname("a/b/c.js?t=123#xx/zz") ==> "a/b/"
// ref: http://jsperf.com/regex-vs-split/2    性能测试，用match和正则提取性能最高
function dirname(path) {
//macth方法是返回匹配结果数组
  return path.match(DIRNAME_RE)[0]
}

// Canonicalize a path
// realpath("http://test.com/a//./b/../c") ==> "http://test.com/a/c"
function realpath(path) {
//   /a/b/./c/./d ==> /a/b/c/d
//上面例子变成： http://test.com/a//b/../c
  path = path.replace(DOT_RE, "/")

  /*
    @author wh1100717
    a//b/c ==> a/b/c
    a///b/////c ==> a/b/c
    DOUBLE_DOT_RE matches a/b/c//../d path correctly only if replace // with / first
  */
//上面例子变成： http://test.com/a/b/../c
  path = path.replace(MULTI_SLASH_RE, "$1/")

  // a/b/c/../../d  ==>  a/b/../d  ==>  a/d
//上面例子变成： http://test.com/a/c
  while (path.match(DOUBLE_DOT_RE)) {
    path = path.replace(DOUBLE_DOT_RE, "/")
  }

  return path
}

// Normalize an id
// normalize("path/to/a") ==> "path/to/a.js"
// NOTICE: substring is faster than negative slice and RegExp
function normalize(path) {
  var last = path.length - 1
//charCodeAt类似charAt，不过它返回的是指定位置字符的Unicode 编码
  var lastC = path.charCodeAt(last)

  // If the uri ends with `#`, just return it without '#'
  if (lastC === 35 /* "#" */) {
    return path.substring(0, last)
  }

//如有本身没有脚本后缀，路径没有参数，不是/结尾，添加脚本后缀
  return (path.substring(last - 2) === ".js" ||
      path.indexOf("?") > 0 ||
      lastC === 47 /* "/" */) ? path : path + ".js"
}

//路径部分
var PATHS_RE = /^([^/:]+)(\/.+)$/
//匹配 {内容}
var VARS_RE = /{([^{]+)}/g

//解析模块alias的值
function parseAlias(id) {
  var alias = data.alias
//如果对应id的数据是字符串，那么就取该字符串，否则返回该id本身
  return alias && isString(alias[id]) ? alias[id] : id
}

//解析模块的路径
function parsePaths(id) {
  var paths = data.paths
  var m

//macth会返回匹配内容结果数组，0为匹配到的整个内容，1为([^/:]+)匹配到的，2为(\/.+)匹配结果
  if (paths && (m = id.match(PATHS_RE)) && isString(paths[m[1]])) {
//m[1]在paths的值连接上m[2]作为id
    id = paths[m[1]] + m[2]
  }

  return id
}

//解析模块里的{}的内容
function parseVars(id) {
  var vars = data.vars

  if (vars && id.indexOf("{") > -1) {
//replace替换函数参数为：（匹配到的完整内容，正则（字表达式）里匹配到的内容，匹配内容开始位置，被匹配的字符串）
//m为匹配到的内容，例如{data},key为data，没了括号
    id = id.replace(VARS_RE, function(m, key) {
      return isString(vars[key]) ? vars[key] : m
    })
  }

  return id
}

function parseMap(uri) {
  var map = data.map
  var ret = uri

  if (map) {
//如果map存在，那么遍历它
    for (var i = 0, len = map.length; i < len; i++) {
      var rule = map[i]

//如果当前map值为函数，那么就把Uri传进去执行，没有返回值的话返回Uri
      ret = isFunction(rule) ?
          (rule(uri) || uri) :
//否则rule为数组，用来替换Uri内容
          uri.replace(rule[0], rule[1])

      // Only apply the first matched rule  也就是说如果处理后的Uri有变化，就退出，不执行后面的rule
      if (ret !== uri) break
    }
  }

  return ret
}

//匹配 //加一个任意字符  或者 :/，绝对路径
var ABSOLUTE_RE = /^\/\/.|:\//
//匹配根目录，如http://test.com/haha  匹配：http://test.com/
var ROOT_DIR_RE = /^.*?\/\/.*?\//

//转化为绝对路径
function addBase(id, refUri) {
  var ret
  var first = id.charCodeAt(0)

  // Absolute  如果id为绝对路径的话，直接赋给ret
  if (ABSOLUTE_RE.test(id)) {
    ret = id
  }
  // Relative  如果是相对路径，且以.开头
  else if (first === 46 /* "." */) {
    ret = (refUri ? dirname(refUri) : data.cwd) + id
  }
  // Root   根目录
  else if (first === 47 /* "/" */) {
    var m = data.cwd.match(ROOT_DIR_RE)
    ret = m ? m[0] + id.substring(1) : id
  }
  // Top-level
  else {
    ret = data.base + id
  }

  // Add default protocol when uri begins with "//"
  if (ret.indexOf("//") === 0) {
    ret = location.protocol + ret
  }

  return realpath(ret)
}

//从模块解析出链接
function id2Uri(id, refUri) {
  if (!id) return ""

  id = parseAlias(id)
  id = parsePaths(id)
  id = parseAlias(id)
  id = parseVars(id)
  id = parseAlias(id)
  id = normalize(id)
  id = parseAlias(id)

  var uri = addBase(id, refUri)
  uri = parseAlias(uri)
  uri = parseMap(uri)

  return uri
}

// For Developers  暴露接口给开发者
seajs.resolve = id2Uri;

// Check environment
//web worker可以异步运行一些耗时复杂的代码，不会弹出超时警告给用户，在web worker里运行作用域和页面上完全不同，不同的全局对象，不同的其他对象和方法。不能接入Dom，不能改变页面
//全局对象是该web worker本身，在web worker里面提供了一个importScripts函数来引入其它脚本
var isWebWorker = typeof window === 'undefined' && typeof importScripts !== 'undefined' && isFunction(importScripts);

// Ignore about:xxx and blob:xxx    blob二进制大文件对象是以blob:开头
var IGNORE_LOCATION_RE = /^(about|blob):/;
//模块加载的目录
var loaderDir;
// Sea.js's full path
var loaderPath;
// Location is read-only from web worker, should be ok though ；web worker里面的运行环境也提供了一个location对象
// cwd ->current working directory，nodejs的process模块有这个命名的方法
var cwd = (!location.href || IGNORE_LOCATION_RE.test(location.href)) ? '' : dirname(location.href);

//如果运行环境是web worker的情况
if (isWebWorker) {
  // Web worker doesn't create DOM object when loading scripts
  // Get sea.js's path by stack trace.
  //Error对象提供了一个非标准的stack属性，可获取该错误之前程序的堆栈的调用详情
  var stack;
  try {
    var up = new Error();
    throw up;
  } catch (e) {
    // IE won't set Error.stack until thrown  因为stack返回的字符串，每一步程序执行都会自动换行，这里转换为数组
    stack = e.stack.split('\n');
  }
  // First line is 'Error'
  stack.shift();

  var m;
  // Try match `url:row:col` from stack trace line. Known formats:   因为stack本身是非标准的，所以各浏览器打印的格式有所用不同
  // Chrome:  '    at http://localhost:8000/script/sea-worker-debug.js:294:25'
  // FireFox: '@http://localhost:8000/script/sea-worker-debug.js:1082:1'
  // IE11:    '   at Anonymous function (http://localhost:8000/script/sea-worker-debug.js:295:5)'
  // Don't care about older browsers since web worker is an HTML5 feature
  var TRACE_RE = /.*?((?:http|https|file)(?::\/{2}[\w]+)(?:[\/|\.]?)(?:[^\s"]*)).*?/i
  // Try match `url` (Note: in IE there will be a tailing ')')
  var URL_RE = /(.*?):\d+:\d+\)?$/;
  // Find url of from stack trace.
  // Cannot simply read the first one because sometimes we will get:
  // Error
  //  at Error (native) <- Here's your problem
  //  at http://localhost:8000/_site/dist/sea.js:2:4334 <- What we want
  //  at http://localhost:8000/_site/dist/sea.js:2:8386
  //  at http://localhost:8000/_site/tests/specs/web-worker/worker.js:3:1
//获取最近一个进程调用的URL
  while (stack.length > 0) {
    var top = stack.shift();
//exec在非全局g的正则时，和match返回数组相同。如果正则是全局g，那么会从正则表达式的lastIndex开始匹配，匹配完之后把lastIndex指向最后匹配到的内容后一个位置
//所以匹配完一个想要匹配另一个字符串时，应该把lastIndex 恢复为0，从头开始匹配
//如果是全局正则匹配用match的话，不返回子表达式匹配的文本的信息等
    m = TRACE_RE.exec(top);
    if (m != null) {
      break;
    }
  }
  var url;
  if (m != null) {
    // Remove line number and column number
    // No need to check, can't be wrong at this point
    var url = URL_RE.exec(m[1])[1];
  }
  // Set
  loaderPath = url
  // Set loaderDir
  loaderDir = dirname(url || cwd);
  // This happens with inline worker.
  // When entrance script's location.href is a blob url,
  // cwd will not be available.
  // Fall back to loaderDir.
  if (cwd === '') {
    cwd = loaderDir;
  }
}
//非web worker情况，普通页面
else {
  var doc = document
//document.scripts返回脚本标签的集合
  var scripts = doc.scripts

  // Recommend to add `seajsnode` id for the `sea.js` script element
  var loaderScript = doc.getElementById("seajsnode") ||
//没有给sea.js加上id的话，获取最后的script标签内容
    scripts[scripts.length - 1]

  function getScriptAbsoluteSrc(node) {
//特性检测，ie6-7没有该方法
    return node.hasAttribute ? // non-IE6/7
//标准浏览器可以通过Dom property取得正确的值URL，但是ie6-7有些问题，使用property方式取URL可能返回相对路径或者绝对路径，为了取得正确值得用getAttribute
      node.src :
      // see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx   4表示返回绝对地址
      node.getAttribute("src", 4)
  }
  loaderPath = getScriptAbsoluteSrc(loaderScript)
  // When `sea.js` is inline, set loaderDir to current working directory    loaderPath为falsy值表示sea在页面内
  loaderDir = dirname(loaderPath || cwd)
}

/**
 * util-request.js - The utilities for requesting script and style files
 * ref: tests/research/load-js-css/test.html
 */
if (isWebWorker) {
  function requestFromWebWorker(url, callback, charset) {
    // Load with importScripts
    var error;
    try {
//web worker需通过importScripts把脚本引入web worker作用域，如果脚本无法加载的话，就会抛出异常，后面的代码也就无法执行了
//另外，虽然引入多个脚本下载次序不一定按次序，但是执行时会按传入脚本顺序
      importScripts(url);
    } catch (e) {
      error = e;
    }
    callback(error);
  }
  // For Developers
  seajs.request = requestFromWebWorker;
}
else {
  var doc = document
  var head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement
//base标签用来定义页面内相对URL的基准路径和目标target
  var baseElement = head.getElementsByTagName("base")[0]

  var currentlyAddingScript

//生成标签发起请求
  function request(url, callback, charset) {
    var node = doc.createElement("script")

//设置字符编码
    if (charset) {
      var cs = isFunction(charset) ? charset(url) : charset
      if (cs) {
        node.charset = cs
      }
    }

//添加事件监听
    addOnload(node, callback, url)

//设为异步执行，如果浏览器支持的话
    node.async = true
//添加资源地址
    node.src = url

    // For some cache cases in IE 6-8, the script executes IMMEDIATELY after
    // the end of the insert execution, so use `currentlyAddingScript` to
    // hold current node, for deriving url in `define` call
    currentlyAddingScript = node

    // ref: #185 & http://dev.jquery.com/ticket/2709
//这个问题简单的说就是在ie6下，如果有base标签的话，插入的脚本运行需要在base标签之前，不然会有问题
    baseElement ?
        head.insertBefore(node, baseElement) :
        head.appendChild(node)

    currentlyAddingScript = null
  }

//对请求的资源添加事件监听，监控加载情况
  function addOnload(node, callback, url) {
//检测script元素是否支持onload事件，应该是HTML5才正式定义了onerror等事件给script吧
    var supportOnload = "onload" in node

//如果支持onload事件
    if (supportOnload) {
//添加脚本加载成功回调
      node.onload = onload
//脚本加载异常回调
      node.onerror = function() {
//在定制的事件对象上触发error事件，后面跟的是错误信息
        emit("error", { uri: url, node: node })
        onload(true)
      }
    }
//不支持onload事件的话
    else {
//注册readystatechange事件
      node.onreadystatechange = function() {
//检测readyState属性是否为完成相关状态
        if (/loaded|complete/.test(node.readyState)) {
          onload()
        }
      }
    }

//成功与否都会调用这个函数，失败的话会告诉回调
    function onload(error) {
      // Ensure only run once and handle memory leak in IE
      node.onload = node.onerror = node.onreadystatechange = null

      // Remove the script to reduce memory leak
//如果不是调试模式的话，那么会移除掉刚生成的script，已经被浏览器编译的代码即使删除了资源还是能执行的
      if (!data.debug) {
        head.removeChild(node)
      }

      // Dereference the node
      node = null

//模块脚本加载完成回调
      callback(error)
    }
  }

  // For Developers
  seajs.request = request

}
var interactiveScript

//用来取得当前正在执行的脚本是哪一个
function getCurrentScript() {
//currentlyAddingScript存在表示当前有正在添加到Dom的脚本，那么正在执行的也就是该script
  if (currentlyAddingScript) {
    return currentlyAddingScript
  }

  // For IE6-9 browsers, the script onload event may not fire right
  // after the script is evaluated. Kris Zyp found that it
  // could query the script nodes and the one that is in "interactive"
  // mode indicates the current script
  // ref: http://goo.gl/JHfFW
//之前查询过的话，看下目前是否仍然在执行该脚本
  if (interactiveScript && interactiveScript.readyState === "interactive") {
    return interactiveScript
  }

  var scripts = head.getElementsByTagName("script")
//从后向前遍历所有script标签，因为脚本是按顺序执行这样找快点，直到找到readyState属性为正在执行状态的为止
  for (var i = scripts.length - 1; i >= 0; i--) {
    var script = scripts[i]
    if (script.readyState === "interactive") {
      interactiveScript = script
      return interactiveScript
    }
  }
}

/**
 * util-deps.js - The parser for dependencies
 * ref: tests/research/parse-dependencies/test.html
 * ref: https://github.com/seajs/searequire
 */

//根据define里的factory函数代码来解析模块的依赖关系,返回依赖关系
//最简单直接的引入是调用require(...)，复杂的例如用for来循环引入，判断条件引入等等
function parseDependencies(s) {
//没有出现require也就没有引入其他模块，不存在依赖，直接返回空数组
  if(s.indexOf('require') == -1) {
    return []
  }
  var index = 0, peek, length = s.length, isReg = 1, modName = 0, parentheseState = 0, parentheseStack = [], res = []

//开始循环判断factroy代码字符串
  while(index < length) {
//从0开始获取s对应位置的字符，返回值保存在peek上
    readch()
//如果peek为空格的话，不做处理
    if(isBlank()) {
    }
	
//如果peek为单引号，双引号的情况
    else if(isQuote()) {
      dealQuote()
//指示为正则表达式
      isReg = 1
    }
	
//如果是左斜杠的话，获取后一位
    else if(peek == '/') {
      readch()
//如果下一位还是左斜杠的话，查一下后面有没有换行符
      if(peek == '/') {
        index = s.indexOf('\n', index)
//不存在换行符的话，就把index指向最后终止位置
        if(index == -1) {
/**为什么这里要用s.length，而不是length，缓存？*/
          index = s.length
        }
      }
//如果下一位是星号的话，查一下当前index之后有没有*/
      else if(peek == '*') {
        index = s.indexOf('*/', index)
//不存在的话，就把index指向最后终止位置
        if(index == -1) {
          index = length
        }
//存在的话index到*/出现位置之后
        else {
          index += 2
        }
      }
//当前为/且为正则表达式状态，那么就要处理正则表达式
      else if(isReg) {
        dealReg()
        isReg = 0
      }
//上面条件都不符合的话，退一位并且标示为正则表达式状态，也就是说作为正则表达式处理
      else {
        index--
        isReg = 1
      }
    }
	
//如果是字母的情况
    else if(isWord()) {
      dealWord()
    }
	
//如果是数字的情况
    else if(isNumber()) {
      dealNumber()
    }
	
//如果是左括号的话，把parentheseState塞进数组，并表示为正则表达式状态
    else if(peek == '(') {
      parentheseStack.push(parentheseState)
      isReg = 1
    }
	
//如果是右括号的话，移除数组最后一位，并返回这个被移除的值
    else if(peek == ')') {
      isReg = parentheseStack.pop()
    }
	
//以上各种情况都不是的话
    else {
      isReg = peek != ']'
      modName = 0
    }
  }
  return res
  
//用来逐个获取s的字符
  function readch() {
    peek = s.charAt(index++)
  }
  
//检测是否为空格
  function isBlank() {
    return /\s/.test(peek)
  }
  
//检测是否为引号
  function isQuote() {
    return peek == '"' || peek == "'"
  }
  
//用来处理匹配到单双引号情况，调用这个函数处理，目的是为了快速把index指向引号结束位置
  function dealQuote() {
//把当前peek所在位置的后一位作为开始查找位置，因为readch执行后index会递增一位
    var start = index
//peek为引号
    var c = peek
//查找引号结束位置，因为引号是成对出现
    var end = s.indexOf(c, start)
//如果没有找到结束引号，把索引指向最后位置的后一位，也就是没有对应值
    if(end == -1) {
      index = length
    }
//找到结束引号，如果该引号前一位不是\的话（第一条斜线是转义用的），也就是说不要转义的字符串冒号。把index指向找到位置的后一位
    else if(s.charAt(end - 1) != '\\') {
      index = end + 1
    }
//找到结束引号但是为转义引号的话，调用readch递增，修改peek的值，之所以这样一个一个判断是因为可能之间还有别的转义符，那些也需要处理
    else {
      while(index < length) {
        readch()
//如果peek到\的（不一定就是上面引号那个，可能之前还有别的），就把index设为该转义字符的后一位（readch递增一次，这里index再递增一次）
        if(peek == '\\') {
          index++
        }
//如果peek到了结束引号字符的位置，就退出循环
        else if(peek == c) {
          break
        }
      }
    }
//modName不为falsy值的话，把引号里的内容添加到res数组里
    if(modName) {
      res.push(s.slice(start, index - 1))
      modName = 0
    }
  }
  
//用来处理正则表达式
  function dealReg() {
//因为上面为了获取/后一位字符调用了readch()，所以index在第一个/的后2位处
    index--
    while(index < length) {
      readch()
//如果当前为\的话，那么就把index再后移一位，等于前移了两位，因为\后面跟的是需要转义的字符，不会是/
      if(peek == '\\') {
        index++
      }
//如果为/的话，退出循环，遇见第二个/表示正则完了
      else if(peek == '/') {
        break
      }
//因为正则中[]也是成对出现的
      else if(peek == '[') {
        while(index < length) {
          readch()
          if(peek == '\\') {
            index++
          }
          else if(peek == ']') {
            break
          }
        }
      }
    }
  }
  
//用来判断是否为大小写字母，以及下划线，美元符
  function isWord() {
    return /[a-z_$]/i.test(peek)
  }
  
//用来处理字母的情况
  function dealWord() {
//复制当前peek位置之后的字符串
    var s2 = s.slice(index - 1)
//匹配所有字符，数字和下划线
    var r = /^[\w$]+/.exec(s2)[0]
//通过新建一个对象，然后[r]等于用来查询r是否在该对象中，有的话返回1，就表示存在。没有的话返回undefined
    parentheseState = {
      'if': 1,
      'for': 1,
      'while': 1,
      'with': 1
    }[r]
    isReg = {
      'break': 1,
      'case': 1,
      'continue': 1,
      'debugger': 1,
      'delete': 1,
      'do': 1,
      'else': 1,
      'false': 1,
      'if': 1,
      'in': 1,
      'instanceof': 1,
      'return': 1,
      'typeof': 1,
      'void': 1
    }[r]
//判断是否存在require模块名
    modName = /^require\s*\(\s*(['"]).+?\1\s*\)/.test(s2)
//有的话则把index前移到require（' 引号内容开始部分，因为目前index是在当前字母后一位，并且r包含了一个引号，因此应该减去2
    if(modName) {
      r = /^require\s*\(\s*['"]/.exec(s2)[0]
      index += r.length - 2
    }
//不存在require的话，就把index移到匹配到的字符组合之后
    else {
      index += /^[\w$]+(?:\s*\.\s*[\w$]+)*/.exec(s2)[0].length - 1
    }
  }
  
//用来判断是否为数字，或者是.数字的情况
  function isNumber() {
    return /\d/.test(peek)
      || peek == '.' && /\d/.test(s.charAt(index))
  }
  
//用来处理数字的情况
  function dealNumber() {
    var s2 = s.slice(index - 1)
    var r
//匹配小数点开头，带e的数字，例如：.14e+2
    if(peek == '.') {
      r = /^\.\d+(?:E[+-]?\d*)?\s*/i.exec(s2)[0]
    }
//匹配是十六进制，这里有一定范围限制
    else if(/^0x[\da-f]*/i.test(s2)) {
      r = /^0x[\da-f]*\s*/i.exec(s2)[0]
    }
//匹配剩下的数字可能，例如：23423.1e+3
    else {
      r = /^\d+\.?\d*(?:E[+-]?\d*)?\s*/i.exec(s2)[0]
    }
//把index移动匹配内容后面，并标示为非正则表达式
    index += r.length - 1
    isReg = 0
  }
}
/**
 * module.js - The core of module loader
 */
//用于缓存加载模块
var cachedMods = seajs.cache = {}
var anonymousMeta

//正在遍历的列表
var fetchingList = {}
//模块提取链接列表
var fetchedList = {}
//回调列表
var callbackList = {}

//用于获取当前处于哪个状态
var STATUS = Module.STATUS = {
  // 1 - The `module.uri` is being fetched
  FETCHING: 1,
  // 2 - The meta data has been saved to cachedMods
  SAVED: 2,
  // 3 - The `module.dependencies` are being loaded
  LOADING: 3,
  // 4 - The module are ready to execute
  LOADED: 4,
  // 5 - The module is being executed
  EXECUTING: 5,
  // 6 - The `module.exports` is available
  EXECUTED: 6,
  // 7 - 404
  ERROR: 7
}

//模块对象构造函数，用来创建新的模块对象，成员属性包括里面this.xxx 
function Module(uri, deps) {
//即 data.cwd + "_use_" + cid()
  this.uri = uri
//deps指的是用户use的模块，例如['./a', './b']
  this.dependencies = deps || []
  this.deps = {} // Ref the dependence modules
  this.status = 0

//因为目前js里没有真正意义上的私有成员，所以目前的私有成员按照惯例是以下划线开头来表示，提醒人注意
//这个_entry用来保存当前模块的实例
  this._entry = []
}

//给模块构造函数拓展方法
// Resolve module.dependencies   
Module.prototype.resolve = function() {
//this 指向当前实例对象
  var mod = this
//mod.dependencies即用户use的模块，例如 seajs.use("../test/main");
  var ids = mod.dependencies
  var uris = []

//遍历当前模块对象的dependencies，把每一个加载的模块和uri传进处理
  for (var i = 0, len = ids.length; i < len; i++) {
//把模块结合uri处理，获取各模块资源地址
    uris[i] = Module.resolve(ids[i], mod.uri)
  }
//返回处理好的模块uri数组
  return uris
}

//把当前模块实例入口entry传给它的依赖模块
Module.prototype.pass = function() {
  var mod = this
//获取当前模块实例用户use的模块数组长度
  var len = mod.dependencies.length

//遍历模块_entry，这里_entry保存了当前模块实例对象自己
  for (var i = 0; i < mod._entry.length; i++) {
    var entry = mod._entry[i]
    var count = 0
//遍历依赖模块
    for (var j = 0; j < len; j++) {
//获取依赖模块的实例对象
      var m = mod.deps[mod.dependencies[j]]
      // If the module is unload and unused in the entry, pass entry to it
      if (m.status < STATUS.LOADED && !entry.history.hasOwnProperty(m.uri)) {
//对于没加载和没用过的模块实例，用链接作为属性名保存到entry历史中
        entry.history[m.uri] = true
        count++
//把大的模块实例入口保存到它的依赖模块的入口属性上
        m._entry.push(entry)
//如果当前这个模块是正在加载中那个
        if(m.status === STATUS.LOADING) {
//那么把它的entry也传递给它的依赖模块
          m.pass()
        }
      }
    }
	
    // If has passed the entry to it's dependencies, modify the entry's count and del it in the module
    if (count > 0) {
//如果把入口传给当前模块实例下的各模块以后，把remain属性值设为它的依赖值，-1是因为remain初始化为1
      entry.remain += count - 1
//然后从这个模块移除掉这个entry
      mod._entry.shift()
      i--
    }
  }

}

// Load module.dependencies and fire onload when all done  用来加载一个模块的相关依赖模块
Module.prototype.load = function() {
  //例如seajs.use("../static/hello/src/main")，那么当前模块实例对象就是data.cwd + "_use_" + cid()，它的依赖就是main
  var mod = this
  // If the module is being loaded, just wait it onload call   如果已经是加载中及之后状态，就退出，这个方法是用于加载
  if (mod.status >= STATUS.LOADING) {
    return
  }

//把当前模块状态设为加载中
  mod.status = STATUS.LOADING

  // Emit `load` event for plugins such as combo plugin   这里的uris当前调用的模块地址，例如seajs.use("../static/hello/src/main"),这里指的是main.js的具体地址
  var uris = mod.resolve()
  
//触发加载事件，并把uri作为数据
  emit("load", uris)

//遍历uris,即要加载的依赖
  for (var i = 0, len = uris.length; i < len; i++) {
//把当前模块依赖的实例对象保存到当前模块的deps属性上，而dependencies属性保存的是依赖的名称，例如：../static/hello/src/main
    mod.deps[mod.dependencies[i]] = Module.get(uris[i])
  }

  // Pass entry to it's dependencies
  mod.pass()
  
  // If module has entries not be passed, call onload
  if (mod._entry.length) {
//如果存在实例入口的话，调用onload事件（最后没有依赖的模块会保留这个_entry）
    mod.onload()
    return
  }

  // Begin parallel loading  模块的加载是平行的
//缓存起来是因为ie6-9的缓存问题，把请求集中到最后一起发送
  var requestCache = {}
  var m

  for (i = 0; i < len; i++) {
//获取缓存的依赖模块实例对象（在创建的时候就会缓存进cachedMods）
    m = cachedMods[uris[i]]

//如果状态是还没有获取，那就去获取模块
    if (m.status < STATUS.FETCHING) {
      m.fetch(requestCache)
    }
//如果模块已经获取且保存了，那么就进行加载
    else if (m.status === STATUS.SAVED) {
      m.load()
    }
  }

  // Send all requests at last to avoid cache bug in IE6-9. Issues#808
//这里遍历每一个缓存好的发送请求
  for (var requestUri in requestCache) {
    if (requestCache.hasOwnProperty(requestUri)) {
//正式发起对当前模块依赖资源的请求
      requestCache[requestUri]()
    }
  }
}

// Call this method when module is loaded
Module.prototype.onload = function() {
  var mod = this
//把模块设置为已加载状态
  mod.status = STATUS.LOADED

  // When sometimes cached in IE, exec will occur before onload, make sure len is an number
  for (var i = 0, len = (mod._entry || []).length; i < len; i++) {
    var entry = mod._entry[i]
//如果没有把entry传给当前模块实例的各组成模块的话，remain默认为1
    if (--entry.remain === 0) {
//执行当前模块加载完成时的回调
      entry.callback()
    }
  }

//直接删除模块的实例入口属性
  delete mod._entry
}

// Call this method when module is 404
Module.prototype.error = function() {
  var mod = this
//也需要触发回调
  mod.onload()
//设置该模块为加载异常状态
  mod.status = STATUS.ERROR
}

// Execute a module
Module.prototype.exec = function () {
  var mod = this

  // When module is executed, DO NOT execute it again. When module
  // is being executed, just return `module.exports` too, for avoiding
  // circularly calling
  if (mod.status >= STATUS.EXECUTING) {
    return mod.exports
  }

//把状态设为执行中
  mod.status = STATUS.EXECUTING

//如果存储模块实例的数组存在，但是里面没有存储内容，就把这个属性删除，例如已经执行过pass方法的
  if (mod._entry && !mod._entry.length) {
    delete mod._entry
  }

  //non-cmd module has no property factory and exports   如果执行的模块非command模块的话就设为non
  if (!mod.hasOwnProperty('factory')) {
    mod.non = true
    return
  }

  // Create require
  var uri = mod.uri

//用来在define里获取其他模块
  function require(id) {
//如果引入的模块在当前模块依赖里有就用，没有的话就去获取该模块实例
    var m = mod.deps[id] || Module.get(require.resolve(id))
//如果发生错误就抛出
    if (m.status == STATUS.ERROR) {
      throw new Error('module was broken: ' + m.uri);
    }
//没有错误就可以执行该模块define里的内容，返回接口
    return m.exec()
  }

  require.resolve = function(id) {
    return Module.resolve(id, uri)
  }

//异步加载模块
  require.async = function(ids, callback) {
    Module.use(ids, callback, uri + "_async_" + cid())
    return require
  }

  // Exec factory
  var factory = mod.factory

//运行defined里定义的factory函数返回模块接口
  var exports = isFunction(factory) ?
//如果factory为函数，那么传入require函数，就可以在define内部引入其他模块
//并且传入当前模块和模块接口对象，mod.exports和mod可以定义一个模块里的接口
    factory(require, mod.exports = {}, mod) :
//不是函数的话，直接factory作为借口
    factory

//如果接口是未定义的话
  if (exports === undefined) {
//就是用当前模块的exports
    exports = mod.exports
  }

  // Reduce memory leak
  delete mod.factory

//把接口保存到当前模块对应属性上
  mod.exports = exports
//把状态设为已执行
  mod.status = STATUS.EXECUTED

  // Emit `exec` event
  emit("exec", mod)

//返回接口
  return mod.exports
}

// Fetch a module  获取模块的请求
Module.prototype.fetch = function(requestCache) {
  var mod = this
  var uri = mod.uri

//设为获取中状态
  mod.status = STATUS.FETCHING

  // Emit `fetch` event for plugins such as combo plugin 插件支持
  var emitData = { uri: uri }
  emit("fetch", emitData)
//requestUri 指的就是依赖模块的资源地址
  var requestUri = emitData.requestUri || uri

  // Empty uri or a non-CMD module
  if (!requestUri || fetchedList.hasOwnProperty(requestUri)) {
    mod.load()
    return
  }

//non-CMD module 非命令模块？
  if (fetchingList.hasOwnProperty(requestUri)) {
    callbackList[requestUri].push(mod)
    return
  }

//把链接作为属性名保存到提取列表，状态为已提取
  fetchingList[requestUri] = true
//把资源地址和该依赖模块对象保存到回调列表，在资源加载完成时使用
  callbackList[requestUri] = [mod]

  // Emit `request` event for plugins such as text plugin
  emit("request", emitData = {
    uri: uri,
    requestUri: requestUri,
    onRequest: onRequest,
    charset: isFunction(data.charset) ? data.charset(requestUri) || 'utf-8' : data.charset
  })

//如果执行request事件没有产requested(不是已经请求过的)
  if (!emitData.requested) {
    requestCache ?
//那么以模块请求地址为名缓存发送请求函数
      requestCache[emitData.requestUri] = sendRequest :
//不存在requestCache的话，直接调用发送请求
      sendRequest()
  }

//发送对模块请求的函数，因为是平行加载，所以先缓存起来
  function sendRequest() {
    seajs.request(emitData.requestUri, emitData.onRequest, emitData.charset)
  }

//模块脚本加载完成时调用的函数
  function onRequest(error) {
//从提取中列表删除该模块，因为已经加载了
    delete fetchingList[requestUri]
//并且把该模块添加到已经提取的列表中
    fetchedList[requestUri] = true

    // Save meta data of anonymous module  保存匿名模块元信息，且把模块状态设为saved
    if (anonymousMeta) {
      Module.save(uri, anonymousMeta)
      anonymousMeta = null
    }

    // Call callbacks
    var m, mods = callbackList[requestUri]
//调用了就从回调列表删除
    delete callbackList[requestUri]
//从头开始一个一个获取模块
    while ((m = mods.shift())) {
      // When 404 occurs, the params error will be true
      if(error === true) {
        m.error()
      }
//没出错就调用load，因为这里是指当前模块的依赖加载好了，还需要继续看依赖里面还有没有依赖，直到没有load里面才会调用onload
      else {
        m.load()
      }
    }
  }
}

//通过模块和相对地址，获得模块的具体资源地址
Module.resolve = function(id, refUri) {
  // Emit `resolve` event for plugins such as text plugin
  var emitData = { id: id, refUri: refUri }
  emit("resolve", emitData)

//如果有emitData.uri就返回（实行上面事件回调的时候产生），没有就调用seajs的resolve(id2uri)来处理，返回处理好的uri
  return emitData.uri || seajs.resolve(emitData.id, refUri)
}

// Define a module   用来定义一个模块，脚本加载进来的时候执行这个define函数，解析出依赖等元信息，脚本加载完成时会调用load，加载这里面的依赖
Module.define = function (id, deps, factory) {
  var argsLen = arguments.length

  // define(factory)
//只传了一个参数
  if (argsLen === 1) {
//该模块本身作为factory
    factory = id
    id = undefined
  }
//如果传了两个参数
  else if (argsLen === 2) {
//把第二个参数作为factory
    factory = deps

//再判断第一个参数，决定是哪种情况
    // define(deps, factory)
    if (isArray(id)) {
      deps = id
      id = undefined
    }
    // define(id, factory)
    else {
      deps = undefined
    }
  }

  // Parse dependencies according to the module factory code
  if (!isArray(deps) && isFunction(factory)) {
//根据factory函数代码（也就是define传进来的函数）来解析依赖，返回解析好的依赖关系
    deps = typeof parseDependencies === "undefined" ? [] : parseDependencies(factory.toString())
  }

//创建模块元信息
  var meta = {
    id: id,
    uri: Module.resolve(id),
    deps: deps,
    factory: factory
  }

  // Try to derive uri in IE6-9 for anonymous modules  直接给use方法传一个函数作为模块的情况
  if (!isWebWorker && !meta.uri && doc.attachEvent && typeof getCurrentScript !== "undefined") {
    var script = getCurrentScript()

//如果是匿名模块，那就把当前正在执行的脚本链接作为它的uri
    if (script) {
      meta.uri = script.src
    }

    // NOTE: If the id-deriving methods above is failed, then falls back
    // to use onload event to get the uri
  }

  // Emit `define` event, used in nocache plugin, seajs node version etc
  emit("define", meta)

//如果uri信息存在的话，就把meta上的模块元信息保存到cachedMods里
  meta.uri ? Module.save(meta.uri, meta) :
    // Save information for "saving" work in the script onload event  上面为匿名模块创建uir失败的话，这里把信息缓存起来
    anonymousMeta = meta
}

// Save meta data to cachedMods
Module.save = function(uri, meta) {
  var mod = Module.get(uri)

  // Do NOT override already saved modules
  if (mod.status < STATUS.SAVED) {
//把元信息保存到模块实例对象上
    mod.id = meta.id || uri
    mod.dependencies = meta.deps || []
    mod.factory = meta.factory
//把该模块状态设为已保存
    mod.status = STATUS.SAVED

    emit("save", mod)
  }
}

//用于获取用户use的模块实例
// Get an existed module or create a new one
Module.get = function(uri, deps) {
//看当前uri有没有缓存，有就返回缓存的，没有的话实例化创建一个并缓存起来
  return cachedMods[uri] || (cachedMods[uri] = new Module(uri, deps))
}

// Use function is equal to load a anonymous module
Module.use = function (ids, callback, uri) {
//创建模块实例，第二个参数为数组是因为构造函数Module里依赖属性是数组，这里的uri指的是data.cwd + "_use_" + cid，不是各独立模块地址
  var mod = Module.get(uri, isArray(ids) ? ids : [ids])

//保留当前模块实例入口，供seajs内部使用
  mod._entry.push(mod)
//定义一个历史属性
  mod.history = {}
//remain后面用于记录里面包含了多少个独立子模块
  mod.remain = 1

//定义回调函数
  mod.callback = function() {
    var exports = []
//获取use里模块的具体uri地址
    var uris = mod.resolve()

//遍历上面的uris数组
    for (var i = 0, len = uris.length; i < len; i++) {
//获取在cachedMods的模块缓存（在define时保存进去的），执行模块factory并返回该模块的接口
      exports[i] = cachedMods[uris[i]].exec()
    }

//这里在全局环境下运行用户在use定义的模块加载完成时的回调
    if (callback) {
      callback.apply(global, exports)
    }

//这里已经完成模块加载执行，删除掉实例上相关数据，避免问题
    delete mod.callback
    delete mod.history
    delete mod.remain
    delete mod._entry
  }

//这里开始加载用户指定的模块
  mod.load()
}


// Public API
//用于调用一个或多个模块，ids为模块标识
seajs.use = function(ids, callback) {
//data.cwd为当前地址，加上_use_和生成的id，组合起来作为uri
  Module.use(ids, callback, data.cwd + "_use_" + cid())
  return seajs
}

Module.define.cmd = {}
//把定义模块的方法拓展到到当前全局变量上
global.define = Module.define


// For Developers

seajs.Module = Module
data.fetchedList = fetchedList
data.cid = cid

seajs.require = function(id) {
  var mod = Module.get(Module.resolve(id))
  if (mod.status < STATUS.EXECUTING) {
//用于调试主要就是加载模块完成时的回调和模块的执行
    mod.onload()
    mod.exec()
  }
//返回该模块的接口
  return mod.exports
}

/**
 * config.js - The configuration for the loader   配置seajs,即调用seajs.config({...});
 */

// The root path to use for id2uri parsing
data.base = loaderDir

// The loader directory
data.dir = loaderDir

// The loader's full path
data.loader = loaderPath

// The current working directory
data.cwd = cwd

// The charset for requesting files
data.charset = "utf-8"

// data.alias - An object containing shorthands of module id
// data.paths - An object containing path shorthands in module id
// data.vars - The {xxx} variables in module id
// data.map - An array containing rules to map module uri
// data.debug - Debug mode. The default value is false

seajs.config = function(configData) {

//遍历用户传进来的配置对象
  for (var key in configData) {
//curr 取得用户定义的配置信息值
    var curr = configData[key]
//prev 取得默认（之前的）的配置信息值
    var prev = data[key]

    // Merge object config such as alias, vars 
//对于那些值为对象的配置，使用用户定义的覆盖，或者新增上去
    if (prev && isObject(prev)) {
      for (var k in curr) {
        prev[k] = curr[k]
      }
    }
    else {
      // Concat array config such as map   对于值为数组的配置就把新的和旧的接起来
      if (isArray(prev)) {
        curr = prev.concat(curr)
      }
      // Make sure that `data.base` is an absolute path  这个base类似于<base>元素，定义基准路径
      else if (key === "base") {
        // Make sure end with "/"
        if (curr.slice(-1) !== "/") {
          curr += "/"
        }
        curr = addBase(curr)
      }

      // Set config  最后把处理好的新配置设置到data
      data[key] = curr
    }
  }

//触发配置事件
  emit("config", configData)
  return seajs
}

})(this);
