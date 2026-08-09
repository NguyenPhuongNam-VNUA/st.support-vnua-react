"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/make-cancellable-promise";
exports.ids = ["vendor-chunks/make-cancellable-promise"];
exports.modules = {

/***/ "(ssr)/./node_modules/make-cancellable-promise/dist/esm/index.js":
/*!*****************************************************************!*\
  !*** ./node_modules/make-cancellable-promise/dist/esm/index.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ makeCancellablePromise)\n/* harmony export */ });\nfunction makeCancellablePromise(promise) {\n    var isCancelled = false;\n    var wrappedPromise = new Promise(function (resolve, reject) {\n        promise\n            .then(function (value) { return !isCancelled && resolve(value); })\n            .catch(function (error) { return !isCancelled && reject(error); });\n    });\n    return {\n        promise: wrappedPromise,\n        cancel: function () {\n            isCancelled = true;\n        },\n    };\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvbWFrZS1jYW5jZWxsYWJsZS1wcm9taXNlL2Rpc3QvZXNtL2luZGV4LmpzIiwibWFwcGluZ3MiOiI7Ozs7QUFBZTtBQUNmO0FBQ0E7QUFDQTtBQUNBLHFDQUFxQyx3Q0FBd0M7QUFDN0Usc0NBQXNDLHVDQUF1QztBQUM3RSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQSIsInNvdXJjZXMiOlsiRDpcXEdyb3VwIFNUXFxzdC5zdXBwb3J0LXZudWEtcmVhY3RcXG5vZGVfbW9kdWxlc1xcbWFrZS1jYW5jZWxsYWJsZS1wcm9taXNlXFxkaXN0XFxlc21cXGluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIG1ha2VDYW5jZWxsYWJsZVByb21pc2UocHJvbWlzZSkge1xuICAgIHZhciBpc0NhbmNlbGxlZCA9IGZhbHNlO1xuICAgIHZhciB3cmFwcGVkUHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgcHJvbWlzZVxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiAhaXNDYW5jZWxsZWQgJiYgcmVzb2x2ZSh2YWx1ZSk7IH0pXG4gICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKGVycm9yKSB7IHJldHVybiAhaXNDYW5jZWxsZWQgJiYgcmVqZWN0KGVycm9yKTsgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcHJvbWlzZTogd3JhcHBlZFByb21pc2UsXG4gICAgICAgIGNhbmNlbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaXNDYW5jZWxsZWQgPSB0cnVlO1xuICAgICAgICB9LFxuICAgIH07XG59XG4iXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/make-cancellable-promise/dist/esm/index.js\n");

/***/ })

};
;