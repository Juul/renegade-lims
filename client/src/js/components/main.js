'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

class Main extends Component {

  render() {
    
    return (
      <div>
        <h3>Main</h3>
          <button onClick={app.actions.increase}>{app.state.count}</button>        
      </div>
    );
  }
}


module.exports = view(Main);
  

