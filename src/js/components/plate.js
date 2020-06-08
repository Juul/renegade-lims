'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

const rowNames = []; // populated with 'A', 'B', 'C' ...
for(let i=65; i <= 90; i++) {
  rowNames.push(String.fromCharCode(i));
}

function findNextFreeWell(rows, cols, occupied) {
  var r, c, key;

  for(c=1; c <= cols; c++) {
    for(r=1; r <= rows; r++) {
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

function wellsToClass(wells, className) {
  var wellsCopy = {};
  for(let well in wells) {
    if(wells[well]) {
      wellsCopy[well] = className;
    }
  }
  return wellsCopy;
}

class Plate extends Component {

  constructor(props) {
    super(props);

    // props.selected format:
    // {
    //   A3: <id>,
    //   B5: <id>
    // }
  }

  componentDidUpdate(prevProps) {
    console.log("update");
    /*
    prevProps = prevProps || {}

    
    this.setState(firstState);
    */
  }
  
  componentDidMount() {
    console.log("mount");
//    this.componentDidUpdate();
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
    if(this.props.onSelect) {
      this.props.onSelect(well);
    }
  }
  
  selectWellClick(event) {
    const well = wellFromEvent(event);
    if(!well) return;
    
    if(!this.props.placingMode) {
      if(!this.props.occupied[well]) return;

      this.selectWell(well);

    } else {
      if(this.props.occupied[well]) return;
      this.selectWell(well);
    }
  }

  hoverWell(event) {
    const well = wellFromEvent(event);
    if(!well) return;

    if(this.props.onhover) {
      this.props.onhover(well);
    }
  }
  
  makeColumn(col, row, occupied, occupiedClass, selectedWell, selectedReplicateGroup) {
    var inner;
    const rowName = rowNames[row-1];
    const well = (rowName || '')+col.toString()
    var number = '';
    
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
      var squareClass = '';
      var dotClass = 'dot';
      var occupiedWell;
      if(rowName) {
        if(selectedWell === well && this.props.placingMode) {
          dotClass += ' selected';
          number = selectedReplicateGroup || '';
        } else {
          occupiedWell = occupiedClass[well];
          if(occupiedWell) {
            dotClass += ' occupied';
            if(occupied[well].special === 'positiveControl') {
              dotClass += ' pos-ctrl';
            } else if(occupied[well].special === 'negativeControl') {
              dotClass += ' neg-ctrl';
            }
            number = occupied[well].replicateGroup || '';
          }
        }
      }
      inner = (
          <div class={dotClass}><div class="replicate-number">{number.toString()}</div></div>
      )
    }
    
    if(!this.props.placingMode && selectedWell === well) {
      squareClass += ' occupied-selected';
    }
    
    var className = 'col col-'+col+' '+squareClass;

    return (
        <div class={className} data-well={well} onClick={this.selectWellClick.bind(this)} onMouseOver={this.hoverWell.bind(this)}>{inner}</div>
    );
  }

  
  render() {
    
    const occupiedClass = (this.props.occupied) ? wellsToClass(this.props.occupied, 'green') : {};
    
    const numRows = this.props.rows || 8;
    const numCols = this.props.cols || 12;

    var nextFreeWell;
    var selectedWell;
    if(this.props.selectedWell) {
      
      selectedWell = this.props.selectedWell;
      
    } else if(this.props.selectFree) {
      
      selectedWell = findNextFreeWell(numRows, numCols, occupiedClass);
      
      if(selectedWell) {
        if(this.props.onSelect) {
          this.props.onSelect(selectedWell);
        }
      }
    }
    
    var rows = [];
    var cols;
    var r, c;
    for(r=0; r <= numRows; r++) {
      cols = []
      for(c=0; c <= numCols; c++) {
        cols.push(
          this.makeColumn(c, r, this.props.occupied, occupiedClass, selectedWell, this.props.selectedReplicateGroup)
        );
      }
      rows.push(this.makeRow(r, cols));
    }

    var buttonsHtml;
    if(this.props.placingMode) {
      if(selectedWell) {
        buttonsHtml = (
            <div>
            <button onClick={this.props.onSave || function(){}}>Save sample to well {selectedWell || ''}</button>
            <button onClick={this.props.onCancel || function(){}}>Cancel</button>
            </div>
        );
      } else {
        buttonsHtml = (
            <p>Click an empty well to move this sample.</p>
        )
      }
    } else {
      if(selectedWell) {
        buttonsHtml = (
            <div>
            <button onClick={this.props.onDelete || function(){}}>Delete</button>
            </div>
        );
      } else {
        buttonsHtml = (
            <span></span>
        )
      }
    }
      

    
    return (
      <div>
        <div class={'plate plate-row-'+numRows + ' plate-col-'+numCols + ' ' + (this.props.addClass || '')}>
        {rows}
      </div>
        {buttonsHtml}
        </div>
    );
  }
}


module.exports = view(Plate);
  
