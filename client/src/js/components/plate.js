'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

const rowNames = []; // populated with 'A', 'B', 'C' ...
for(let i=65; i <= 90; i++) {
  rowNames.push(String.fromCharCode(i));
}

class Plate extends Component {

  constructor(props) {
    super(props);

    // props.selected format:
    // {
    //   A3: 'red',
    //   B5: 'green
    // }
    
    this.setState({
      selected: props.selected,
      rows: 8,
      cols: 12
    });
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
  
  makeColumn(col, row) {
    var inner;
    const rowName = rowNames[row-1];
    if(!row) {
      if(!col) {
        inner = '';
      } else {
        inner = col.toString();
      }
    } else {
      if(!col) {
        console.log("RO", row);
        return (
            <div class="hcol">{rowName}</div>
        )
      }
      var dotClass = 'dot';
      var selected;
      if(rowName) {
        selected = this.state.selected[rowName+col.toString()];
        if(selected) {
          dotClass += ' ' + selected;
        }
      }
      inner = (
          <div class={dotClass}></div>
      )
    }
    var className = 'col col-'+col;

    return (
        <div class={className}>{inner}</div>
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
  
