import { Component, createContext, createElement } from 'react'
import firebase from 'firebase/app'
import 'firebase/database'

let fb = firebase
let log = _ => {}
const { Provider, Consumer } = createContext()

const isTemplate = path => typeof path === 'string' && path.indexOf('$') !== -1

export default class extends Component {
  constructor(props) {
    super(props)

    this.state = {}
    this.ref = {}
    this.tmpl = {}
    this.call = {}
    this.prop = {}
    this.validProps = this.validProps.bind(this)
    this.optionalProps = this.optionalProps.bind(this)
    this.toVars = this.toVars.bind(this)
    this.toImpl = this.toImpl.bind(this)
    this.download = this.download.bind(this)
    this.inject = this.inject.bind(this)
    this.eject = this.eject.bind(this)
    this.tmplToVal = this.tmplToVal.bind(this)

    if (props.hasOwnProperty('debug')) {
      log = msg => console.log(msg)
    }

    if (fb === firebase && props.hasOwnProperty('init')) {
      log('[LazyFlame] initializing firebase')
      fb = firebase.initializeApp(props.init)
    }

    if (props.hasOwnProperty('uid')) {
      log('[LazyFlame] registering auth')
      
      require('firebase/auth')
      this.unregisterAuthObserver = fb.auth().onAuthStateChanged((user) => {
        const uid = user ? user.uid : undefined
        if (this.state.uid === uid) return

        log(`[LazyFlame] auth {uid: ${uid}}`)
        this.setState({ uid: uid })
      })
    }

    for (const prop in props) {
      switch (prop) {
      case 'children': continue
      case 'debug': continue
      case 'init': continue
      default:
      }

      let [ varName ] = prop.split('-')

      this.prop[varName] = prop
      this.state[varName] = undefined

      const path = this.validProps(prop)
      const isTmpl = isTemplate(path)

      if (!isTmpl && typeof path === 'string') {
        log(`[LazyFlame] ${varName}@${path}`)
        this.ref[prop] = fb.database().ref(path)
      } else if (isTmpl) {
        this.tmpl[prop] = {}
      }
    }

    this.state.set = vars => {
      for (const varName in vars) {
        let v = vars[varName]
        let prop = this.prop[varName]

        if (this.tmpl[prop]) {
          const { impl, val } = this.toImpl(varName, v)
          prop = `${prop}@${impl}`
          v = val
          log(`[LazyFlame] varName=${varName} v=${JSON.stringify(v, null, 2)}`)
        }

        const val = vars[varName]
        
        this.ref[prop].set(v)
        log(`[LazyFlame] upload ${prop} ${JSON.stringify(v, null, 2)}`)

        this.setState(state => {
          log(`[LazyFlame] state.${varName} ${JSON.stringify({[varName]: state[varName]}, null, 2)}\n=> ${JSON.stringify({[varName]: val}, null, 2)}`)
          
          if (typeof val !== 'object') return {[varName]: val}
          else return {[varName]: Object.assign({}, state[varName], val)}
        })
      }
    }

    log('[LazyFlame] constructed')
  }

  componentDidMount() {
    log('[LazyFlame] componentDidMount')
    
    for (const full in this.ref) {
      const [ prop ] = full.split('@')
      const [ varName, on ] = prop.split('-')

      if (!this.ref[full]) continue
      
      if (!on) {
        this.ref[full].once('value', this.download(varName)).catch(console.error)
      } else {
        this.call[full] = this.ref[full].on('value', this.download(varName), e => console.error(e))
      }
    }
  }

  componentWillUnmount() {
    log('[LazyFlame] componentWillUnmount')

    if (this.unregisterAuthObserver) {
      log('[LazyFlame] unregistering auth')

      this.unregisterAuthObserver()
      delete this.unregisterAuthObserver
    }

    for (const prop in this.call) {
      log(`[LazyFlame] off {${prop}}`)
      this.ref[prop].off('value', this.call[prop])
    }
  }

  validProps(prop) {
    const p = this.props[prop]
    return typeof p === 'string'
      ? p.replace('?', '')
      : p
  }

  optionalProps(prop) {
    const p = this.props[prop]
    return typeof p === 'string' && p.indexOf('?') !== -1
  }

  toImpl(varName, obj) {
    const tmpl = this.validProps(this.prop[varName])
    let impl = tmpl

    let varEx = /\$([^/]+)/
    let ptr = obj

    for (const v of this.toVars(tmpl)) {
      const val = this.tmplToVal(v)
      const key = Object.keys(ptr)[0]
      const isObj = typeof val === 'object'
      
      const impl2 = impl.replace(varEx, isObj ? key : val)
      log(`[LazyFlame] impl ${JSON.stringify(impl, null, 2)}\n=>\n${JSON.stringify(impl2, null, 2)}`)
      impl = impl2

      if (isObj) ptr = obj[key]
    }
  
    return {impl: impl, val: ptr}
  }

  inject(path) {
    let paths = {[path]: true}
    let varEx = /\$([^/]+)/
    let match
  
    while (!!(match = varEx.exec(path))) {
      let [ varName, ...children ] = match[1].split('.')
  
      if (this.state[varName] === undefined || this.state[varName] === null) {
        log(`[LazyFlame] ${varName} not downloaded; skipping inject`)
        return
      }
  
      let obj = this.state[varName]
      if (children) {
        for (let child of children) {
          obj = obj[child]
        }
      }
  
      if (typeof obj !== 'object') {
        obj = {[ obj ]: true}
      }
  
      let paths2 = {}
      for (let key in obj) {
        for (path in paths) {
          paths2[path.replace(match[0], key)] = true
        }
      }
      paths = paths2
    }
  
    return paths
  }

  tmplToVal(tmplVar) {
    if (!/^\$[a-z]+(\.[a-z]+)*$/i.test(tmplVar)) return
    
    let [ varName, ...children ] = tmplVar.substr(1).split('.')
    
    if (this.state[varName] === undefined || this.state[varName] === null) return
    if (!children) return this.state[varName]
  
    let obj = this.state[varName]
    for (let child of children) {
      obj = obj[child]
    }
    return obj
  }

  toVars(tmpl) {
    const tms = tmpl.split('/')
    let vars = []
    for (const v of tms) {
      if (v.indexOf('$') === -1) continue
      vars.push(v)
    }
    return vars
  }

  eject(tmpl, impl) {
    const tms = tmpl.split('/')
    const ims = impl.split('/')
    let vars = {}
    for (const i in tms) {
      if (tms[i].indexOf('$') === -1) continue

      vars[tms[i]] = {
        type: typeof this.tmplToVal(tms[i]),
        value: ims[i]
      }
    }
    return vars
  }

  download(varName, tmpl, impl) {
    return snapshot => {
      const val = snapshot.val()
      
      if (!tmpl && !impl) {
        log(`[LazyFlame] download ${JSON.stringify({[varName]: val}, null, 2)}`)
        this.setState({[varName]: val})
        return
      }

      this.setState(state => {
        let ptr = state
        let v = varName
        
        const vars = this.eject(tmpl, impl)

        for (const k in vars) {
          const { type, value } = vars[k]
          if (type !== 'object') continue

          if (ptr[v] === undefined || ptr[v] === null) ptr[v] = {}
          ptr = ptr[v]
          v = value
        }

        ptr[v] = val
        
        log(`[LazyFlame] download (recursive) ${JSON.stringify({[varName]: state[varName]}, null, 2)}`)
        return state
      })
    }
  }
  
  render() {
    // templates
    for (const prop in this.tmpl) {
      const tmpl = this.validProps(prop)
      const newPaths = this.inject(tmpl)

      if (!newPaths) {
        if (this.optionalProps(prop)) continue

        log(`[LazyFlame] failed to inject ${tmpl}; skipping render`)
        return null
      }

      // clean up
      for (const old in this.tmpl[prop]) {
        if (newPaths[old]) continue
        
        const full = `${prop}@${old}`

        log(`[LazyFlame] cleaning up {${full}}`)

        const [, on ] = prop.split('-')
        if (on) {
          this.ref[full].off('value', this.call[full])
          delete this.call[full]
        }
        
        delete this.ref[full]
        delete this.tmpl[prop][old]
      }
      
      log(`[LazyFlame] new paths ${prop}@${JSON.stringify(Object.keys(newPaths), null, 2)}`)
      
      // add in
      for (const path in newPaths) {
        const full = `${prop}@${path}`
        
        if (this.tmpl[prop][path]) continue
        
        log(`[LazyFlame] injecting ${this.validProps(prop)}; ${path}`)
        this.tmpl[prop][path] = true

        const [ varName, on ] = prop.split('-')

        if (!on) {
          this.ref[full] = fb.database().ref(path)
          this.ref[full].once('value', this.download(varName, tmpl, path)).catch(console.error)
        } else {
          this.ref[full] = fb.database().ref(path)
          this.call[full] = this.ref[full].on('value', this.download(varName, tmpl, path), e => console.error(e))
        }
      }
    }
    
    // ready vars
    for (const varName in this.state) {
      if (this.state[varName] !== undefined && this.state[varName] !== null) continue
      if (this.optionalProps(this.prop[varName])) {
        log(`[LazyFlame] ${varName} optional; continuing render`)
        continue
      }
      
      log(`[LazyFlame] ${varName} not downloaded; skipping render`)
      return null
    }

    const notConsumer = Object.keys(this.prop).length > 0
    const notProvider = typeof this.props.children === 'function'

    switch (true) {
    case notProvider && notConsumer:
      log('[LazyFlame] render')
      return this.props.children(this.state)

    case notConsumer:
      log('[LazyFlame] render <Provider>')
      return createElement(Provider, {value: this.state}, this.props.children)

    case notProvider:
      return createElement(Consumer, null, db => {
        log('[LazyFlame] render <Consumer>')
        return this.props.children(db)
      })

    default:
      log('[LazyFlame] render null')
      return null
    }
  }
}
