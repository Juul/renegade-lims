'use strict';

import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

import Container from '@material-ui/core/Container';
const LabContainer = require('./lab_container.js');

class TestLabContainer extends Component {

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
      <Container>
        <LabContainer />
      </Container>
    );
  }
}


module.exports = view(TestLabContainer);
  
