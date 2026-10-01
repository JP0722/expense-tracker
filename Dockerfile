FROM node:22-alpine AS frontend
WORKDIR /web
COPY web/package*.json web/.npmrc ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM golang:1.27-alpine AS backend
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /penny ./cmd/server

FROM alpine:3.23
RUN apk add --no-cache ca-certificates && addgroup -S penny && adduser -S penny -G penny
WORKDIR /app
COPY --from=backend /penny /app/penny
COPY --from=frontend /web/dist /app/web/dist
RUN mkdir /app/data && chown penny:penny /app/data
USER penny
ENV PORT=8080
EXPOSE 8080
CMD ["/app/penny"]
