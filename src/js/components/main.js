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
        <li><Link href="/tube-intake-1id">Sample intake 1 ID accessioning</Link></li>
        <li><Link href="/tube-intake-with-print">Sample intake with print</Link></li>
        <li><Link href="/tube-intake-phi">Sample intake with PHI print</Link></li>
        <li><Link href="/map-tubes-to-plate">Map samples/tubes to plate/rack</Link></li>
        <li><Link href="/map-racks-to-plates-chori">Map 48 tube racks to 96 well plates using Integra robot</Link></li>
        <li><Link href="/map-racks-to-plates">Map 48 tube racks to 96 well plates using OpenTrons</Link></li>
        <li><Link href="/map-96-to-384-integra">Map 96 well plate(s) to 384 well plate using Integra</Link></li>
        <li><Link href="/map-96-to-384">Map 96 well plate(s) to 384 well plate using Liquidator</Link></li>
        <li><Link href="/analyze-qpcr">Analyze qPCR results</Link></li>
        <li><Link href="/rack-scan">Scan 48 tube rack</Link></li>
        <li><Link href="/calculate-pcr-master-mix">Calculate PCR Master Mix</Link></li>
        <li><Link href="/print-tube-label">Print tube barcode label</Link></li>
        <li><Link href="/print-plate-label">Print plate barcode label</Link></li>
        <li><Link href="/accessioned">Show recently accessioned</Link></li>
        <li><Link href="/csv">Export to CSV</Link></li>
        <li><Link href="/remap-qpcr-results">Convert qPCR results to Ligolab format</Link></li>
        <li><Link href="/scan">Scan (work in progress)</Link></li>
        <li><Link href="/print-test">Print (work in progress)</Link></li>
        <li><Link href="/print-old-multilabel">Print old multi label (no longer used)</Link></li>
        </ul>


      </Container>
    );
  }
}

module.exports = view(Main);
