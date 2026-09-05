# Convenience wrapper. Every target has an `npm run` equivalent that works
# without make, which is the path Windows contributors should use.
#
# The venv interpreter lives in a different place per platform.
ifeq ($(OS),Windows_NT)
PY := apps/api/.venv/Scripts/python.exe
else
PY := apps/api/.venv/bin/python
endif

.DEFAULT_GOAL := help
.PHONY: help install install-web install-api up down logs web api migrate revision \
        test test-api lint lint-web lint-api typecheck check

help: ## Show available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: install-web install-api ## Install web and API dependencies

install-web: ## Install workspace node modules
	npm install

install-api: ## Create the API virtualenv and install it editable
	python -m venv apps/api/.venv
	$(PY) -m pip install --upgrade pip
	cd apps/api && ../../$(PY) -m pip install -e ".[dev]"

up: ## Start postgres, redis and the API in docker
	docker compose up -d --build

down: ## Stop the docker stack
	docker compose down

logs: ## Tail docker logs
	docker compose logs -f

web: ## Run the Next.js app on :3000
	npm run dev

api: ## Run the API on :8000 with reload
	cd apps/api && ../../$(PY) -m uvicorn crm.main:app --host 127.0.0.1 --port 8000 --reload

migrate: ## Apply migrations up to head
	cd apps/api && ../../$(PY) -m alembic upgrade head

seed: ## Create the demo tenant and one user per role
	cd apps/api && ../../$(PY) scripts/seed_data.py

revision: ## Autogenerate a migration: make revision m="add contacts"
	cd apps/api && ../../$(PY) -m alembic revision --autogenerate -m "$(m)"

test: test-api ## Run all tests

test-api: ## Run API tests
	cd apps/api && ../../$(PY) -m pytest

lint: lint-web lint-api ## Lint everything

lint-web: ## ESLint the web app
	npm run lint

lint-api: ## Ruff the API
	cd apps/api && ../../$(PY) -m ruff check .

typecheck: ## Typecheck web and API
	npm run typecheck
	cd apps/api && ../../$(PY) -m mypy

check: lint typecheck test ## Everything CI would run
