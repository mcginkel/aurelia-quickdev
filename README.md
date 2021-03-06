# ![aurelia-quickdev](aurelia-quickdev.png)

This library is a plugin for the [Aurelia](http://www.aurelia.io/) framework.  It's goal is to make using Xebics Quickdev with Aurelia as seamless as possible.

What's included:

1. An adapter for observing Quickdev entities.

## FAQ

**Why does Aurelia need an adapter to observe Quickdev entities?**

Quickdev entity properties have defined getters and setters created using Object.defineProperty.  Properties defined in this manner are incompatible with Object.observe, Aurelia's preferred way to do data-binding.  In situations where Object.observe cannot be used Aurelia falls back to dirty-checking which can be less performant.  We can avoid dirty-checking by providing Aurelia with an adapter that knows to subscribe to the Quickdev propertyChanged event in order to observe Quickdev entities.

## Using The Adapter

This guide uses [jspm](http://jspm.io/) and assumes you've already setup your Aurelia project according to the guide [here](http://aurelia.io/get-started.html).

1. Use jspm to install aurelia-quickdev.

  ```shell
  jspm install aurelia-quickdev
  ```
2. Install quickdev:

  ```shell
  jspm install quickdev
  ```
3. Use the plugin in your app's main.js:

  ```javascript
  export function configure(aurelia) {
    aurelia.use
      .standardConfiguration()
      .plugin('aurelia-quickdev');  // <--------<<

    aurelia.start().then(a => a.setRoot());
  }
  ```
4. Now you're ready to use Breeze in your Aurelia application:

  ```javascript

  ```

## Dependencies

* [aurelia-binding](https://github.com/aurelia/binding)
* [aurelia-dependency-injection](https://github.com/aurelia/dependency-injection)
* [quickdev](http://www.xebic.com/)

## Platform Support

This library can be used in the **browser** only.

## Building The Code

To build the code, follow these steps.

1. Ensure that [NodeJS](http://nodejs.org/) is installed. This provides the platform on which the build tooling runs.
2. From the project folder, execute the following command:

  ```shell
  npm install
  ```
3. Ensure that [Gulp](http://gulpjs.com/) is installed. If you need to install it, use the following command:

  ```shell
  npm install -g gulp
  ```
4. To build the code, you can now run:

  ```shell
  gulp build
  ```
5. You will find the compiled code in the `dist` folder, available in three module formats: AMD, CommonJS and ES6.

6. See `gulpfile.js` for other tasks related to generating the docs and linting.

## Running The Tests

To run the unit tests, first ensure that you have followed the steps above in order to install all dependencies and successfully build the library. Once you have done that, proceed with these additional steps:

1. Ensure that the [Karma](http://karma-runner.github.io/) CLI is installed. If you need to install it, use the following command:

  ```shell
  npm install -g karma-cli
  ```
2. Ensure that [jspm](http://jspm.io/) is installed. If you need to install it, use the following commnand:

  ```shell
  npm install -g jspm
  ```
3. Install the client-side dependencies with jspm:

  ```shell
  jspm install
  ```
4. You can now run the tests with this command:

  ```shell
  karma start
  ```
