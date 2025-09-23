export default [
  {
    rules: {
      // Equivalent to jshint esversion:8, asi:true, laxbreak:true
      "semi": ["error", "never"],
      "no-extra-semi": "off",
      "no-unreachable": "error",
      "no-unused-vars": "warn"
    },
    languageOptions: {
      ecmaVersion: 2017,
      sourceType: "script"
    }
  }
];
