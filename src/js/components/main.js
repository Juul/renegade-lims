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
        <li><Link href="/tube-intake">Sample intake (associate tubes with accession forms)</Link></li>
          <li><Link href="/map-tubes-to-plate">Map samples to 96 well plate</Link></li>
          <li><Link href="/analyze-qpcr">Analyze qPCR results</Link></li>
        <li><Link href="/print-tube-label">Print tube barcode label</Link></li>
        <li><Link href="/print-plate-label">Print plate barcode label</Link></li>
        <li><Link href="/csv">Export to CSV</Link></li>
          <li><Link href="/scan">Scan (work in progress)</Link></li>
        <li><Link href="/print-test">Print (work in progress)</Link></li>
        <li><Link href="/print-old-multilabel">Print old multi label (no longer used)</Link></li>
        </ul>


      </Container>
    );
  }
}

module.exports = view(Main);
