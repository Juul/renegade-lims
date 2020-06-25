'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

class LabContainer extends Component {

  constructor(props) {
    super(props);

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
  
  render() {
    
    return (
      <div>
        LAB CONTAINER
      </div>
    );
  }
}


module.exports = view(LabContainer);
  
