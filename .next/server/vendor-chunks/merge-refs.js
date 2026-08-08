"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/merge-refs";
exports.ids = ["vendor-chunks/merge-refs"];
exports.modules = {

/***/ "(ssr)/./node_modules/merge-refs/dist/esm/index.js":
/*!***************************************************!*\
  !*** ./node_modules/merge-refs/dist/esm/index.js ***!
  \***************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ mergeRefs)\n/* harmony export */ });\n/**\n * A function that merges React refs into one.\n * Supports both functions and ref objects created using createRef() and useRef().\n *\n * Usage:\n * ```tsx\n * <div ref={mergeRefs(ref1, ref2, ref3)} />\n * ```\n *\n * @param {(React.Ref<T> | undefined)[]} inputRefs Array of refs\n * @returns {React.Ref<T> | React.RefCallback<T>} Merged refs\n */\nfunction mergeRefs() {\n    var inputRefs = [];\n    for (var _i = 0; _i < arguments.length; _i++) {\n        inputRefs[_i] = arguments[_i];\n    }\n    var filteredInputRefs = inputRefs.filter(Boolean);\n    if (filteredInputRefs.length <= 1) {\n        var firstRef = filteredInputRefs[0];\n        return firstRef || null;\n    }\n    return function mergedRefs(ref) {\n        filteredInputRefs.forEach(function (inputRef) {\n            if (typeof inputRef === 'function') {\n                inputRef(ref);\n            }\n            else if (inputRef) {\n                inputRef.current = ref;\n            }\n        });\n    };\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvbWVyZ2UtcmVmcy9kaXN0L2VzbS9pbmRleC5qcyIsIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsYUFBYSw2QkFBNkI7QUFDMUM7QUFDQTtBQUNBLFdBQVcsOEJBQThCO0FBQ3pDLGFBQWEscUNBQXFDO0FBQ2xEO0FBQ2U7QUFDZjtBQUNBLHFCQUFxQix1QkFBdUI7QUFDNUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0EiLCJzb3VyY2VzIjpbIkQ6XFxHcm91cCBTVFxcc3Quc3VwcG9ydC12bnVhLXJlYWN0XFxub2RlX21vZHVsZXNcXG1lcmdlLXJlZnNcXGRpc3RcXGVzbVxcaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBIGZ1bmN0aW9uIHRoYXQgbWVyZ2VzIFJlYWN0IHJlZnMgaW50byBvbmUuXG4gKiBTdXBwb3J0cyBib3RoIGZ1bmN0aW9ucyBhbmQgcmVmIG9iamVjdHMgY3JlYXRlZCB1c2luZyBjcmVhdGVSZWYoKSBhbmQgdXNlUmVmKCkuXG4gKlxuICogVXNhZ2U6XG4gKiBgYGB0c3hcbiAqIDxkaXYgcmVmPXttZXJnZVJlZnMocmVmMSwgcmVmMiwgcmVmMyl9IC8+XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0geyhSZWFjdC5SZWY8VD4gfCB1bmRlZmluZWQpW119IGlucHV0UmVmcyBBcnJheSBvZiByZWZzXG4gKiBAcmV0dXJucyB7UmVhY3QuUmVmPFQ+IHwgUmVhY3QuUmVmQ2FsbGJhY2s8VD59IE1lcmdlZCByZWZzXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIG1lcmdlUmVmcygpIHtcbiAgICB2YXIgaW5wdXRSZWZzID0gW107XG4gICAgZm9yICh2YXIgX2kgPSAwOyBfaSA8IGFyZ3VtZW50cy5sZW5ndGg7IF9pKyspIHtcbiAgICAgICAgaW5wdXRSZWZzW19pXSA9IGFyZ3VtZW50c1tfaV07XG4gICAgfVxuICAgIHZhciBmaWx0ZXJlZElucHV0UmVmcyA9IGlucHV0UmVmcy5maWx0ZXIoQm9vbGVhbik7XG4gICAgaWYgKGZpbHRlcmVkSW5wdXRSZWZzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgIHZhciBmaXJzdFJlZiA9IGZpbHRlcmVkSW5wdXRSZWZzWzBdO1xuICAgICAgICByZXR1cm4gZmlyc3RSZWYgfHwgbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmN0aW9uIG1lcmdlZFJlZnMocmVmKSB7XG4gICAgICAgIGZpbHRlcmVkSW5wdXRSZWZzLmZvckVhY2goZnVuY3Rpb24gKGlucHV0UmVmKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGlucHV0UmVmID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgaW5wdXRSZWYocmVmKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGlucHV0UmVmKSB7XG4gICAgICAgICAgICAgICAgaW5wdXRSZWYuY3VycmVudCA9IHJlZjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcbn1cbiJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/merge-refs/dist/esm/index.js\n");

/***/ })

};
;