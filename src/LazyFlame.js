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
    this.download = this.download.bind(this)
    this.inject = this.inject.bind(this)
    this.eject = this.eject.bind(this)

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

      const path = props[prop]
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
        const val = vars[varName]

        this.ref[this.prop[varName]].set(val)
        log(`[LazyFlame] upload {${varName}: ${JSON.stringify(val, null, 2)}}`)
        
        this.setState({[varName]: val})
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

  download(varName, tmpl, impl) {
    return snapshot => {
      const val = snapshot.val()
      
      if (!tmpl && !impl) {
        log(`[LazyFlame] download ${JSON.stringify({[varName]: val}, null, 2)}`)
        this.setState({[varName]: val})
        return
      }

      this.setState(state => {
        const og = state[varName] !== undefined ? state[varName] : {}
        let ptr = og

        log(`[LazyFlame] typeof ${varName} is ${typeof val}`)
        if (typeof val !== 'object') {
          return {[varName]: val}
        }
        
        const vars = this.eject(tmpl, impl)
        for (const i in vars) {
          const v = vars[i]
          if (ptr[v] === undefined || ptr[v] === null) ptr[v] = {}
          if (i+1 < vars.length) ptr = ptr[v]
          else ptr[v] = val
        }
        
        log(`[LazyFlame] download (recursive) ${JSON.stringify({[varName]: og}, null, 2)}`)
        return {[varName]: og}
      })
    }
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

  eject(tmpl, impl) {
    const tms = tmpl.split('/')
    const ims = impl.split('/')
    let vars = []
    for (const i in tms) {
        if (tms[i].indexOf('$') !== -1) vars.push(ims[i])
    }
    return vars
  }
  
  render() {
    // templates
    for (const prop in this.tmpl) {
      const tmpl = this.props[prop]
      const newPaths = this.inject(tmpl)

      if (!newPaths) {
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
        
        log(`[LazyFlame] injecting ${this.props[prop]}; ${path}`)
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
