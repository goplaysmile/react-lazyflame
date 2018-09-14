# LazyFlame

### A *super easy* way to use Firebase in a React App

* LazyFlame Just Work️s™️

```jsx
<LazyFlame age="my/age">
  {db => <div>{db.age}</div>}
</LazyFlame>
```

* LazyFlame can authenticate

```jsx
<LazyFlame
  uid
  name="name/$uid"
>
  {db => <div>{db.uid}'s name is {db.name}</div>}
</LazyFlame>
```

* LazyFlame is global

```jsx
<LazyFlame age="this/is/my/age">
  <Child />
</LazyFlame>

...

const Child = () => (
  <LazyFlame>
    {db => <div>{db.age}</div>}
  </LazyFlame>
)
```

* LazyFlame can be not-lazy

```jsx
<LazyFlame time-on="real/time">
  {db => <div>It is now {db.time}</div>}
</LazyFlame>
```

* LazyFlame can write

```jsx
<LazyFlame sign="my/sign">
  {db => (
    <button onClick={() => db.set({sign: 'Leo'})}>
      {db.sign}
    </button>
  )}
</LazyFlame>
```

* LazyFlame has optional vars

```jsx
<LazyFlame ready="val/not/ready?">
  {db => db.ready ? <div>We are {db.ready}</div> : null}
</LazyFlame>
```

* LazyFlame spreads

```jsx
<LazyFlame
  names="all/names"
  face="face/$names"
>
  {db => <img src={db.face['john-doe']} />}
</LazyFlame>
```

* LazyFlame handles layers

```jsx
<LazyFlame
  obj="super/deep/object"
  field="$obj.a.b.c"
>
  {db => <div>{db.field}</div>}
</LazyFlame>
```

* LazyFlame is complex

```jsx
<LazyFlame
  obj-on="an/obj"
  list="my/list"
  dict-on="my/dict"
  objDict="obj/dict"
  combo-on="a/$list/n/$obj.val/n/$dict/$objDict.val"
>
  {db => <div>{db.combo}</div>}
</LazyFlame>
```

* And of course, LazyFlame won't leave you in the dark

```jsx
<LazyFlame
  debug
  test="check/console/logs"
>
  {db => (
    <button onClick={() => db.set({test: 'ok!'})}>
      {db.test}
    </button>
  )}
</LazyFlame>
```
