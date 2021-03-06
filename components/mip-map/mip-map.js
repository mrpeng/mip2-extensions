import './mip-map.less'

const { CustomElement, util, viewer, sandbox } = MIP
const log = util.log('mip-map')

/**
 * 工具方法 拼接键值对
 *
 * @param {Object} obj 需要处理的对象
 * @returns {string} 拼接字符串
 */
function traverseAndConcat (obj) {
  return Object.keys(obj).reduce((total, key) => total + obj[key], '')
}

/**
 * 工具方法 转驼峰式字符串为短横线分隔式字符串
 *
 * @param {string} str 驼峰式字符串
 * @returns {string} 短横线分隔式字符串
 */
function hyphenate (str) {
  return str.replace(/[A-Z]/g, s => ('-' + s.toLowerCase())).replace(/^-/, '')
}

export default class MIPMap extends CustomElement {
  constructor (...args) {
    super(...args)

    this.map = null
    this.point = {}
    this.marker = null
    this.currentMarker = null
  }

  connectedCallback () {
    let el = this.element
    let config = {}

    try {
      config = util.jsonParse(el.querySelector('script[type="application/json"]').textContent)
    } catch (e) {
      log.warn(e)
    }
    this.config = config

    this.ak = el.getAttribute('ak') || config.ak || ''
    this.location = this.getObjAttribute('location')
    this.controls = this.getObjAttribute('controls')
    this.info = this.getObjAttribute('info')
    this.hideMap = this.getBoolAttribute('hideMap')
    this.getPosition = this.getBoolAttribute('getPosition')
    this.dataOnlyGetSdk = this.getBoolAttribute('dataOnlyGetSdk')
  }

  /**
   * 获取类型为对象的属性值
   *
   * @param {string} str 属性名
   * @returns {Object} 属性值
   */
  getObjAttribute (str) {
    let el = this.element
    let obj = null
    if (el.hasAttribute(str)) {
      try {
        obj = util.jsonParse(el.getAttribute(str))
      } catch (e) {
        log.warn(e)
      }
    } else {
      obj = this.config[str]
    }
    return obj
  }

  /**
   * 获取类型为布尔的属性值
   *
   * @param {string} camelCase 驼峰式属性名
   * @returns {boolean} 属性值
   */
  getBoolAttribute (camelCase) {
    let el = this.element
    let kebabCase = hyphenate(camelCase)
    if (el.hasAttribute(kebabCase)) {
      return el.getAttribute(kebabCase) !== 'false'
    }
    if (el.hasAttribute(camelCase)) {
      log.warn(`标签属性应使用短横线分隔式：${kebabCase}`)
      return el.getAttribute(camelCase) !== 'false'
    }
    if (this.config.hasOwnProperty(camelCase)) {
      return this.config[camelCase] !== false
    }
    if (this.config.hasOwnProperty(kebabCase)) {
      log.warn(`在 <script type="json/application"></script> 中参数应使用驼峰式：${camelCase}`)
      return this.config[kebabCase] !== false
    }
    return false
  }

  /**
   * 仅加载sdk
   *
   */
  loadSdk () {
    let BMap = window.BMap

    // BMap注入沙盒
    Object.defineProperty(sandbox, 'BMap', {
      value: BMap,
      writable: false,
      enumerable: true,
      configurable: true
    })

    // 派发事件
    viewer.eventAction.execute('loaded', this.element, {})
  }

  /**
   * 自动定位
   *
   */
  getCurrentLocation () {
    var _that = this;
    let BMap = window.BMap
    let geolocation = new BMap.Geolocation()
    geolocation.getCurrentPosition(res => {
      // 无定位权限
      if (!res.accuracy) {
        return viewer.eventAction.execute('getPositionFailed', this.element, res)
      } else if (geolocation.getStatus() === window.BMAP_STATUS_SUCCESS) {
        this.currentMarker = new BMap.Marker(res.point)
        this.map.addOverlay(this.currentMarker)
        this.map.panTo(res.point)

        // 派发事件
        viewer.eventAction.execute('getPositionComplete', this.element, res)
      }
    }, {enableHighAccuracy: true})
  }

  /**
   * 加入指定的覆盖物
   */
  addPoint(t, stores){
    if(!stores) stores = this.getObjAttribute('stores')
    let BMap = window.BMap
    let BMapLib = window.BMapLib
    //第一步，清除覆盖物
    this.map.clearOverlays();

    //计算中心点
    let points = [];
    for(let i=0;i<stores.length;i++){
      points.push({"lng":stores[i].lng,"lat":stores[i].lat});
    }
    let view = this.map.getViewport(eval(points));
    let mapZoom = view.zoom;
    let centerPoint = view.center;
    this.map.centerAndZoom(centerPoint,mapZoom);

    //添加覆盖物
    for(let i=0; i<stores.length; i++){
      let tmpPoint = new BMap.Point(stores[i].lng, stores[i].lat);
      let tmpMarker = new BMap.Marker(tmpPoint);
      this.map.addOverlay(tmpMarker);
      let searchInfoWindow = null;
      let content = '<div style="margin:0;line-height:20px;padding:2px;">' +
        '' +
        '地址：'+stores[i].info+'<br/>' +
        '</div>';
      searchInfoWindow = new BMapLib.SearchInfoWindow(this.map, content, {
        title  : stores[i].name,      //标题
        width  : 260,             //宽度
        height : 105,              //高度
        panel  : "panel",         //检索结果面板
        enableAutoPan : true,     //自动平移
        searchTypes   :[
          BMAPLIB_TAB_SEARCH,   //周边检索
          BMAPLIB_TAB_TO_HERE,  //到这里去
          BMAPLIB_TAB_FROM_HERE //从这里出发
        ]
      });
      tmpMarker.addEventListener('click', () => {
        searchInfoWindow.open(tmpMarker);
      })
    }
    //添加完成
  }

  //弹出一个标点
  addInfo(t, store){
    if(!store){ store = this.getObjAttribute('store')}
    let BMap = window.BMap
    let BMapLib = window.BMapLib

    let tmpPoint = new BMap.Point(store.lng, store.lat);
    let tmpMarker = new BMap.Marker(tmpPoint);
    let searchInfoWindow = null;
    let content = '<div style="margin:0;line-height:20px;padding:2px;">' +
      '' + store.info+'<br/>' +
      '</div>';
    searchInfoWindow = new BMapLib.SearchInfoWindow(this.map, content, {
      title  : store.name,      //标题
      width  : 290,             //宽度
      height : 105,              //高度
      panel  : "panel",         //检索结果面板
      enableAutoPan : true,     //自动平移
      searchTypes   :[
        BMAPLIB_TAB_SEARCH,   //周边检索
        BMAPLIB_TAB_TO_HERE,  //到这里去
        BMAPLIB_TAB_FROM_HERE //从这里出发
      ]
    });
    searchInfoWindow.open(tmpMarker);
  }

  /**
   * 定位至local配置的位置
   *
   */
  searchLocation () {
    let BMap = window.BMap

    // 配置地址
    let address = traverseAndConcat(this.location)

    // 没有定位信息，则使用自动定位
    if (!address || !this.location.city) {
      this.getCurrentLocation()
      viewer.eventAction.execute('searchLocalFailed', this.element, {})
      return
    }
    let options = {
      onSearchComplete: results => {
        if (local.getStatus() !== window.BMAP_STATUS_SUCCESS) {
          return
        }
        let firstResult = results.getPoi(0)
        this.point = firstResult.point
        if (!firstResult || !this.point) {
          return
        }
        this.marker = new BMap.Marker(this.point)
        this.map.addOverlay(this.marker)
        this.map.centerAndZoom(this.point, 15)

        // 配置弹层
        this.setInfoWindow()
      }
    }

    // 搜索并定位地址
    let local = new BMap.LocalSearch(this.map, options)
    local.search(address)
  }

  /**
   * 配置弹层信息
   *
   */
  setInfoWindow () {
    let BMap = window.BMap
    if (!this.info) {
      return
    }
    let infoWindow = new BMap.InfoWindow(this.info.content, this.info)
    this.marker.addEventListener('click', () => {
      this.map.openInfoWindow(infoWindow, this.point)
    })
  }

  /**
   * 配置地图控件
   *
   */
  addControls () {
    let BMap = window.BMap
    let controls = this.controls

    Object.keys(controls).forEach(key => {
      let params = controls[key] || {}

      // 识别 BMAP_* 常量
      Object.keys(params).forEach(prop => {
        let val = params[prop]
        if (typeof val === 'string' && val.indexOf('BMAP_') !== -1) {
          params[prop] = window[val]
        }
        if (Array.isArray(val)) {
          let array = val.map(v => {
            if (v.indexOf('BMAP_') !== -1) {
              return window[v]
            }
            return v
          })
          params[prop] = array
        }
      })

      let Fn = BMap[key]
      Fn && this.map.addControl(new Fn(params))
    })
  }

  /**
   * 根据配置执行相应方法
   *
   */
  resolveOptions () {
    let BMap = window.BMap

    // 仅加载SDK，不初始化地图
    if (this.dataOnlyGetSdk) {
      return this.loadSdk()
    }

    // 初始化地图
    this.map = new BMap.Map('allmap')
    //init
    this.map.centerAndZoom(new BMap.Point(116.404, 39.915), 11)

    // 自动定位、或者手动定位
    this.getPosition ? this.getCurrentLocation() : this.searchLocation()

    // 暴露自动定位方法
    this.addEventAction('getLocal', () => {
      // 可能会在未完全初始化的时候调用
      this.getMapJDK().then(this.getCurrentLocation.bind(this))
    })
    // 配置控件
    this.controls && this.addControls()
  }

  /**
   * 异步加载地图jdk
   *
   */
  getMapJDK () {
    if (!window.BMap) {
      window.BMap = {}
      window.BMap._insertScript = new Promise(resolve => {
        window._initBaiduMap = () => {
          resolve(window.BMap)
          window.document.body.removeChild(script)
          window.BMap._insertScript = null
          window._initBaiduMap = null

          let script1 = document.createElement('script')
          window.document.body.appendChild(script1)
          script1.src = `https://api.map.baidu.com/library/SearchInfoWindow/1.5/src/SearchInfoWindow_min.js`

          let link1 = document.createElement('link')
          window.document.body.appendChild(link1)
          link1.rel="stylesheet";
          link1.href = `http://api.map.baidu.com/library/SearchInfoWindow/1.5/src/SearchInfoWindow_min.css`
        }
      })
      let script = document.createElement('script')
      window.document.body.appendChild(script)
      script.src = `https://api.map.baidu.com/api?v=2.0&ak=${this.ak}&callback=_initBaiduMap`
      return window.BMap._insertScript
    } else if (!window.BMap._insertScript) {
      return Promise.resolve(window.BMap)
    }
    return window.BMap._insertScript
  }


  firstInviewCallback () {
    let wrapper = document.createElement('div')
    wrapper.id = 'allmap'
    this.hideMap && wrapper.classList.add('hideMap')
    this.element.appendChild(wrapper)

    this.getMapJDK().then(this.resolveOptions.bind(this))
  }
  // 插入文档时执行
  build () {
    this.addEventAction('addInfo', this.addInfo.bind(this))
    this.addEventAction('addPoint', this.addPoint.bind(this))
  }
}
