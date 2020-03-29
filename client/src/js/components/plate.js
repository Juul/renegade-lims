'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

const rowNames = []; // populated with 'A', 'B', 'C' ...
for(let i=65; i <= 90; i++) {
  rowNames.push(String.fromCharCode(i));
}

function findNextFreeWell(rows, cols, occupied) {
  var r, c, key;

  for(r=1; r <= rows; r++) {
    for(c=1; c <= cols; c++) {
      key = rowNames[r-1]+c.toString();
      if(!occupied[key]) return key;
    }
  }
  return null;
}

function wellElementFromEvent(event) {
  var el = event.target;
  if(!el) return;
  while(!el.classList.contains('col')) {
    if(!el.parentNode) return null;
    el = el.parentNode;
  }
  return el;
}

function wellFromEvent(event) {
  const el = wellElementFromEvent(event);
  if(!el) return null;
  const well = el.getAttribute('data-well');
  if(!well.match(/^[A-Z]\d\d?$/)) return null;
  return well;
}

class Plate extends Component {

  constructor(props) {
    super(props);

    // props.selected format:
    // {
    //   A3: <id>,
    //   B5: <id>
    // }

    const firstState = {
      occupied: props.occupied || {},
      rows: props.rows || 8,
      cols: props.cols || 12
    };

    const nextFreeWell = findNextFreeWell(firstState.rows, firstState.cols, firstState.occupied);
    if(nextFreeWell) {
      firstState.selected = nextFreeWell;
      if(props.onselect) {
        props.onselect(nextFreeWell);
      }
    }
    
    this.setState(firstState);
  }
  
  makeRow(l, inner) {
    inner = inner || '';
    if(!l) {
      return (
        <div class="hrow header">
            {inner}
        </div>
      );
    } else {
      const className = 'row row-'+l;
      return (
          <div class={className}>
          {inner}
        </div>
      );
    }
  }

  selectWell(well) {
    if(this.props.onselect) {
      this.props.onselect(well);
    }
  }
  
  selectWellClick(event) {
    const well = wellFromEvent(event);
    if(!well) return;
    if(this.state.occupied[well]) return;
    this.setState({
      selected: well
    });
    this.selectWell(well);
  }

  hoverWell(event) {
    const well = wellFromEvent(event);
    if(!well) return;

    if(this.props.onhover) {
      this.props.onhover(well);
    }
  }
  
  makeColumn(col, row) {
    var inner;
    const rowName = rowNames[row-1];
    const well = (rowName || '')+col.toString()
    if(!row) {
      if(!col) {
        inner = '';
      } else {
        inner = col.toString();
      }
    } else {
      if(!col) {
        return (
            <div class="hcol">{rowName}</div>
        )
      }
      var dotClass = 'dot';
      var occupied;
      if(rowName) {
        if(this.state.selected === well) {
            dotClass += ' selected';          
        } else {
          occupied = this.state.occupied[well];
          if(occupied) {
            dotClass += ' occupied';
          }
        }
      }
      inner = (
          <div class={dotClass}></div>
      )
    }
    var className = 'col col-'+col;

    return (
        <div class={className} data-well={well} onClick={this.selectWellClick.bind(this)} onMouseOver={this.hoverWell.bind(this)}>{inner}</div>
    );
  }
  
  render() {

    var rows = [];
    var cols;
    var r, c;
    for(r=0; r <= this.state.rows; r++) {
      cols = []
      for(c=0; c <= this.state.cols; c++) {
        cols.push(
          this.makeColumn(c, r)
        );
      }
      rows.push(this.makeRow(r, cols));
    }

    return (
      <div id="my-plate" class="plate">
        {rows}
      </div>
    );
  }
}


module.exports = view(Plate);
  
