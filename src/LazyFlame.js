import { Component, createContext, createElement } from 'react'
import firebase from 'firebase/app'
import 'firebase/database'

let fb
let log = _ => {}
const { Provider, Consumer } = createContext()

const isTemplate = path => typeof path === 'string' && path.indexOf('$') !== -1

export default class extends Component {
  constructor(props) {
    super(props)

    this.state = {}
    this.ref = {}
    this.call = {}
    this.path = {}
    this.prop = {}
    this.download = this.download.bind(this)

    if (props.hasOwnProperty('debug')) {
      log = msg => console.log(msg)
    }

    if (!fb && props.hasOwnProperty('init')) {
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

      if (!isTemplate(path) && typeof path === 'string') {
        log(`[LazyFlame] ${varName}@${path}`)
        this.ref[prop] = fb.database().ref(path)
      } else {
        this.ref[prop] = undefined
      }
    }

    log('[LazyFlame] constructor')

    this.state.set = vars => {
      for (const varName in vars) {
        this.ref[this.prop[varName]].set(vars[varName])
        this.setState({[varName]: vars[varName]})
      }
    }
  }

  componentDidMount() {
    log('[LazyFlame] componentDidMount')
    
    for (const prop in this.ref) {
      const [ varName, on ] = prop.split('-')

      if (!this.ref[prop]) continue
      
      if (!on) {
        this.ref[prop].once('value', this.download(varName)).catch(console.error)
      } else {
        this.call[prop] = this.ref[prop].on('value', this.download(varName), e => console.error(e))
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
      this.ref[prop].off('value', this.call[prop])
    }
  }

  download(prop) {
    return snapshot => {
      const val = snapshot.val()
      log(`[LazyFlame] download {${prop}: ${JSON.stringify(val)}}`)
      this.setState({[prop]: val})
    }
    // const sanitize = (prop, snapshot) => {
    //   if (!snapshot.hasChildren()) {
    //     log(`[LazyFlame] download {${prop}: ${snapshot.val()}}`)
    //     return snapshot.val()
    //   }
    //   let obj = []
    //   snapshot.forEach(snapshot => {
    //     obj[snapshot.key] = sanitize(`${prop}.${snapshot.key}`, snapshot)
    //   })
    //   return obj
    // }
    
    // return snapshot => {
    //   this.setState({[prop]: sanitize(prop, snapshot)})
    // }
  }
  
  render() {
    for (const prop in this.ref) {
      let path = this.props[prop]
      if (!isTemplate(path)) continue

      let varEx = /\$([^/.]+)/
      let match
      while (!!(match = varEx.exec(path))) {
        const varName = match[1]
        if (this.state[varName] === undefined || this.state[varName] === null) {
          log(`[LazyFlame] ${varName} not downloaded; skipping render`)
          return null
        }

        path = path.replace(match[0], this.state[varName])
      }

      if (this.path[prop] === path) continue
      log(`[LazyFlame] injecting ${this.props[prop]}; ${path}`)
      this.path[prop] = path

      const [ varName, on ] = prop.split('-')

      if (!on) {
        this.ref[prop] = fb.database().ref(path)
        this.ref[prop].once('value', this.download(varName)).catch(console.error)
      } else {
        this.ref[prop].off('value', this.call[prop])
        this.ref[prop] = fb.database().ref(path)
        this.call[prop] = this.ref[prop].on('value', this.download(varName), e => console.error(e))
      }
    }
    
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
