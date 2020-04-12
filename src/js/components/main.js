'use strict';

import { h, Component } from 'preact';
import { Link } from 'preact-router/match';
import { view } from 'z-preact-easy-state';

import Container from '@material-ui/core/Container';

class Main extends Component {

  render() {

    const button = (
        <button onClick={app.actions.increase}>{app.state.count}</button>
    );
    
    return (
      <Container>
        <h3>Main</h3>
        <ul>
          <li><Link href="/map-tubes-to-plate">Map tubes to plate</Link></li>
          <li><Link href="/plate-test">Plate test</Link></li>
          <li><Link href="/print-plate-label">Print plate barcode label</Link></li>
          <li><Link href="/scan">Scan</Link></li>
          <li><Link href="/print-test">Print</Link></li>
        </ul>


      </Container>
    );
  }
}

module.exports = view(Main);
