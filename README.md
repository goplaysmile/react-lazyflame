# LazyFlame
A React component that lazily loads realtime database values

#### Example 1:

```jsx
<LazyFlame
  year-on="some/year"
  names="born/$year"
>
  {db => (
    <div>
      <div>Born in {db.year}:</div>
      <ol>
        {db.names.map(name => (
          <li>{name}</li>
        ))}
      </ol>
    </div>
  )}
</LazyFlame>
```

The example above downloads 'born/$year' -> **names** once for every 'some/year' -> **year** update.

#### Example component App:

```jsx
import React from 'react'
import LazyFlame from 'react-lazyflame'

const config = { ... }

const External = () => (
  <LazyFlame>
    {db => (
      <div>
        <div>Born in {db.year}:</div>
        <ol>
          {db.names.map((name, i) => <li key={i}>{name}</li>)}
        </ol>
        <button onClick={() => db.set({year: db.year+1})}>Add Year</button>
      </div>
    )}
  </LazyFlame>
)

export default () => (
  <div className="App">
    <LazyFlame firebase-config={config} DEBUG
      year="some/year"
      names="born/$year"
    >
      <External />
    </LazyFlame>
  </div>
)
```

The example above initializes Firebase with **firebase-config**, prints console.log messages with **DEBUG**, and uses React's Context.Provider/Consumer to teleport downloaded values to other components that use **\<LazyFlame\>**. On every button click, **year** -> 'some/year' in the realtime database increases by one. Notice **year** doesn't have the '-on' appended to the prop name; it will only download once but internally keep track of the uploaded/set value which also will retrigger a download from 'born/$year' -> **names** each time.
