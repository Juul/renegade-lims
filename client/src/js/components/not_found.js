
import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

class NotFound extends Component {


  render() {

    return (
        <div>
        <h3>Page not found</h3>
        </div>
    )
  }
};


module.exports = view(NotFound);
