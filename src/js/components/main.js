'use strict';

import { h, Component } from 'preact';
import { Link } from 'preact-router/match';
import { view } from 'z-preact-easy-state';

class Main extends Component {

  render() {

    const button = (
        <button onClick={app.actions.increase}>{app.state.count}</button>
    );
    
    return (
      <div>
        <h3>Main</h3>
        <ul>
          <li><Link href="/plate-test">Plate</Link></li>
          <li><Link href="/scan">Scan</Link></li>
          <li><Link href="/print-test">Print</Link></li>
        </ul>


      </div>
    );
  }
}

module.exports = view(Main);
