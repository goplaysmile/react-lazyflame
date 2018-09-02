import { Component, createContext, createElement } from 'react'
import firebase from 'firebase/app'
import 'firebase/database'

const { Provider, Consumer } = createContext()

export default class extends Component {
  constructor(props) {
    super(props)

    this.state = {}
    this.ref = {}
    this.call = {}
    this.path = {}
    this.prop = {}
    this.log = msg => {}
    this.download = this.download.bind(this)

    for (const prop in props) {
      switch (prop) {
      case 'children': continue
      case 'firebase-config': firebase.initializeApp(props[prop]); continue
      case 'DEBUG': this.log = msg => console.log(msg); continue
      default:
      }

      const [ varName ] = prop.split('-')

      this.prop[varName] = prop
      this.state[varName] = undefined

      if (props[prop].indexOf('$') === -1) {
        this.log(`[LazyFlame] ${varName}@${props[prop]}`)
        this.ref[prop] = firebase.database().ref(props[prop])
      } else {
        this.ref[prop] = undefined
      }
    }

    this.log(`[LazyFlame] constructor`)

    this.state.set = vars => {
      for (const varName in vars) {
        this.ref[this.prop[varName]].set(vars[varName])
        this.setState({[varName]: vars[varName]})
      }
    }
  }

  componentDidMount() {
    this.log(`[LazyFlame] componentDidMount`)
    
    for (const prop in this.ref) {
      const [ varName, on ] = prop.split('-')

      if (!this.ref[prop]) continue
      
      if (!on) {
        this.ref[prop].once('value', this.download(varName))
      } else {
        this.call[prop] = this.ref[prop].on('value', this.download(varName))
      }
    }
  }

  componentWillUnmount() {
    this.log(`[LazyFlame] componentWillUnmount`)

    for (const prop in this.call) {
      this.ref[prop].off('value', this.call[prop])
    }
  }

  download(prop) {
    return snapshot => {
      const val = snapshot.val()
      this.log(`[LazyFlame] download {${prop}: ${JSON.stringify(val)}}`)
      this.setState({[prop]: val})
    }
    // const sanitize = (prop, snapshot) => {
    //   if (!snapshot.hasChildren()) {
    //     this.log(`[LazyFlame] download {${prop}: ${snapshot.val()}}`)
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
    this.log(`[LazyFlame] render`)

    for (const prop in this.ref) {
      let path = this.props[prop]
      if (path.indexOf('$') === -1) continue

      let varEx = /\$([^/.]+)/
      let match
      while (!!(match = varEx.exec(path))) {
        const varName = match[1]
        if (this.state[varName] === undefined || this.state[varName] === null) {
          this.log(`[LazyFlame] ${varName} not downloaded; skipping render`)
          return null
        }

        path = path.replace(match[0], this.state[varName])
      }

      if (this.path[prop] === path) continue
      this.log(`[LazyFlame] injecting ${this.props[prop]}; ${path}`)
      this.path[prop] = path

      const [ varName, on ] = prop.split('-')

      if (!on) {
        this.ref[prop] = firebase.database().ref(path)
        this.ref[prop].once('value', this.download(varName))
      } else {
        this.ref[prop].off('value', this.call[prop])
        this.ref[prop] = firebase.database().ref(path)
        this.call[prop] = this.ref[prop].on('value', this.download(varName))
      }
    }
    
    for (const varName in this.state) {
      if (this.state[varName] !== undefined && this.state[varName] !== null) continue

      this.log(`[LazyFlame] ${varName} not downloaded; skipping render`)
      return null
    }

    const notConsumer = Object.keys(this.prop).length > 0
    const notProvider = typeof this.props.children === 'function'

    switch (true) {
    case notProvider && notConsumer:
      return this.props.children(this.state)

    case notConsumer:
      this.log(`[LazyFlame] <Provider>`)
      return createElement(Provider, {value: this.state}, this.props.children)

    case notProvider:
      this.log(`[LazyFlame] <Consumer>`)
      return createElement(Consumer, null, db => this.props.children(db))

    default:
      this.log(`[LazyFlame] null render`)
      return null
    }
  }
}
