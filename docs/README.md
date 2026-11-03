# Documentation

- [HTTP setup, authentication, requests and responses](API.md)
- [Complete Persian endpoint reference](API-REFERENCE.fa.md)
- [OpenAPI 3.1 specification](openapi.json)
- [Postman collection](saman-api.postman_collection.json)
- [Login and SMS workflow](LOGIN-FLOW.fa.md)
- [Digital rial and transaction detail notes](DETALS-CHANGES.fa.md)
- [Python SDK guide](../python/README.md)
- [Complete Python method reference](../python/docs/reference.md)

Execute all service and CLI commands from the repository root. To regenerate
the Postman collection from the checked-in OpenAPI document, run:

```sh
npm run postman:build
```

This updates `docs/saman-api.postman_collection.json`. It does not send requests.
