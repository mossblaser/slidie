import pytest

from typing import Iterator, Any

from pathlib import Path
from subprocess import run
from contextlib import chdir

from slidie.scripts.slidie_mv_cmd import (
    FilesNotInSameDirectoryError,
    common_parent_directory,
    NumberingParams,
    infer_numbering_parameters,
    move_file,
    main,
)


class TestCommonParentDirectory:
    def test_empty(self) -> None:
        with pytest.raises(ValueError):
            common_parent_directory([])

    def test_same_dir(self) -> None:
        assert common_parent_directory(
            [
                Path("/foo/1.svg"),
                Path("/foo/bar/.././2.svg"),
            ]
        ) == Path("/foo")

    def test_different_dir(self) -> None:
        with pytest.raises(FilesNotInSameDirectoryError):
            common_parent_directory(
                [
                    Path("/foo/1.svg"),
                    Path("/bar/2.svg"),
                ]
            )


class TestInferNumberingParameters:
    @pytest.mark.parametrize(
        "filenames, exp",
        [
            (["0"], 1),
            (["1"], 1),
            (["1", "2", "3"], 1),
            (["123"], 3),
            (["+123"], 4),
            (["-123"], 4),
        ],
    )
    def test_num_digits(self, filenames: list[str], exp: int) -> None:
        assert infer_numbering_parameters(list(map(Path, filenames))).num_digits == exp

    @pytest.mark.parametrize(
        "filenames, exp",
        [
            (["0"], False),
            (["1"], False),
            (["-1"], True),
        ],
    )
    def test_allow_negative(self, filenames: list[str], exp: bool) -> None:
        assert (
            infer_numbering_parameters(list(map(Path, filenames))).allow_negative is exp
        )

    @pytest.mark.parametrize(
        "filenames, exp",
        [
            # Clamped at minimum of 10
            (["0"], 10),
            (["1"], 10),
            # Guess common '10' and '100' cases without leading zeros
            (["10"], 10),
            (["100"], 100),
            # Guess common '10' and '100' cases with leading zeros
            (["010"], 10),
            (["0100"], 100),
            (["0100", "0000"], 100),
            (["00100"], 100),
            (["00100", "00000"], 100),
            # Excessively large cases (check we generalise)
            (["0001000"], 1000),
            (["000010000"], 10000),
        ],
    )
    def test_preferred_step_size(self, filenames: list[str], exp: int) -> None:
        assert (
            infer_numbering_parameters(list(map(Path, filenames))).preferred_step_size
            == exp
        )


class TestMoveFile:
    @pytest.fixture
    def example_dir(self, tmp_path: Path) -> Iterator[Path]:
        """
        Test directory for all tests.

        Will chdir into this directory.

        Three files, a.txt, b.txt and c.txt with 'a.txt' being in git.
        """
        with chdir(tmp_path):
            (tmp_path / "a.txt").write_text("a")
            (tmp_path / "b.txt").write_text("b")
            (tmp_path / "c.txt").write_text("c")

            run(["git", "init", "."], check=True)
            run(["git", "add", "a.txt"], check=True)
            run(["git", "commit", "-m", "initial commit"], check=True)

            yield tmp_path

    def test_simple_moves(self, example_dir: Path) -> None:
        move_file(example_dir / "a.txt", example_dir / "a2.txt")
        move_file(example_dir / "b.txt", example_dir / "b2.txt")

        # Files were moved
        assert not (example_dir / "a.txt").is_file()
        assert not (example_dir / "b.txt").is_file()
        assert (example_dir / "a2.txt").read_text() == "a"
        assert (example_dir / "b2.txt").read_text() == "b"

        # Verify git used for file managed by git by undoing the change
        run(["git", "commit", "-m", "file moved"], check=True)
        run(["git", "revert", "HEAD"], check=True)
        assert not (example_dir / "a2.txt").is_file()
        assert (example_dir / "a.txt").read_text() == "a"

        # The non-git-managed file shouldn't have moved
        assert not (example_dir / "b.txt").is_file()
        assert (example_dir / "b2.txt").read_text() == "b"

    def test_disable_git(self, example_dir: Path) -> None:
        move_file(example_dir / "a.txt", example_dir / "a2.txt", False)

        # Should delete file in git
        run(["git", "commit", "-a", "-m", "delete file"], check=True)

        # Verify this by reverting the commit and checking if the destination
        run(["git", "revert", "HEAD"], check=True)

        assert (example_dir / "a.txt").is_file()
        assert (example_dir / "a.txt").read_text() == "a"

        assert (example_dir / "a2.txt").is_file()
        assert (example_dir / "a2.txt").read_text() == "a"

    def test_destination_exists(self, example_dir: Path) -> None:
        # Git file
        with pytest.raises(FileExistsError):
            move_file(example_dir / "a.txt", example_dir / "c.txt")

        # Git file (no-git-mode)
        with pytest.raises(FileExistsError):
            move_file(example_dir / "a.txt", example_dir / "c.txt", False)

        # Non-git file
        with pytest.raises(FileExistsError):
            move_file(example_dir / "b.txt", example_dir / "c.txt")


class TestCLIApp:
    @pytest.fixture
    def example_dir(self, tmp_path: Path) -> Iterator[Path]:
        """
        Test directory for all tests.

        Will chdir into this directory.
        """
        with chdir(tmp_path):
            run(["git", "init", "."], check=True)

            for f in ["0100", "0200", "0300", "0400", "0401"]:
                (tmp_path / f"{f}.svg").write_text(f)
                run(["git", "add", f"{f}.svg"], check=True)
            run(["git", "commit", "-m", "initial commit"], check=True)

            yield tmp_path

    def test_after(self, example_dir: Path) -> None:
        main(["0100.svg", "0200.svg", "--after", "0300.svg"])
        assert {f.name: f.read_text() for f in example_dir.glob("*.svg")} == {
            "0300.svg": "0300",
            "0333.svg": "0100",
            "0366.svg": "0200",
            "0400.svg": "0400",
            "0401.svg": "0401",
        }

    def test_before(self, example_dir: Path) -> None:
        main(["0100.svg", "0200.svg", "--before", "0400.svg"])
        assert {f.name: f.read_text() for f in example_dir.glob("*.svg")} == {
            "0300.svg": "0300",
            "0333.svg": "0100",
            "0366.svg": "0200",
            "0400.svg": "0400",
            "0401.svg": "0401",
        }

    def test_start(self, example_dir: Path) -> None:
        main(["0200.svg", "0300.svg", "--start"])
        assert {f.name: f.read_text() for f in example_dir.glob("*.svg")} == {
            "0032.svg": "0200",
            "0066.svg": "0300",
            "0100.svg": "0100",
            "0400.svg": "0400",
            "0401.svg": "0401",
        }

    def test_end(self, example_dir: Path) -> None:
        main(["0100.svg", "0200.svg", "--end"])
        assert {f.name: f.read_text() for f in example_dir.glob("*.svg")} == {
            "0300.svg": "0300",
            "0400.svg": "0400",
            "0401.svg": "0401",
            "0501.svg": "0100",
            "0601.svg": "0200",
        }

    def test_insert(self, example_dir: Path, capsys: Any) -> None:
        main(["--insert", "--after", "0100.svg"])
        out, _ = capsys.readouterr()
        assert out.strip() == "0150"

    def test_insert_many(self, example_dir: Path, capsys: Any) -> None:
        main(["--insert=3", "--after", "0100.svg"])
        out, _ = capsys.readouterr()
        assert out.strip() == "0125\n0150\n0175"

    def test_insert_start(self, example_dir: Path, capsys: Any) -> None:
        main(["--insert", "--start"])
        out, _ = capsys.readouterr()
        assert out.strip() == "0049"

    def test_insert_end(self, example_dir: Path, capsys: Any) -> None:
        main(["--insert", "--end"])
        out, _ = capsys.readouterr()
        assert out.strip() == "0501"

    def test_git_mv(self, example_dir: Path) -> None:
        main(["0100.svg", "--after", "0200.svg"])

        # Verify git mv *was* used by reverting the commit and checking if the
        # moved file moved back
        run(["git", "commit", "-a", "-m", "move file"], check=True)
        run(["git", "revert", "HEAD"], check=True)

        assert (example_dir / "0100.svg").is_file()
        assert not (example_dir / "0250.svg").is_file()

    def test_no_git_mv(self, example_dir: Path) -> None:
        main(["0100.svg", "--after", "0200.svg", "--no-git-mv"])

        # Verify git mv wasn't used by reverting the commit and checking if the
        # moved file is still in the new location (i.e. git thought the old
        # location was deleted)
        run(["git", "commit", "-a", "-m", "delete file"], check=True)
        run(["git", "revert", "HEAD"], check=True)

        assert (example_dir / "0100.svg").is_file()
        assert (example_dir / "0250.svg").is_file()

    def test_allow_negative(self, example_dir: Path, capsys: Any) -> None:
        (example_dir / "0.svg").touch()

        main(["--insert", "--before", "0.svg", "--allow-negative"])
        out, _ = capsys.readouterr()
        assert out.strip() == "-100"

    def test_implicit_allow_negative(self, example_dir: Path, capsys: Any) -> None:
        (example_dir / "-1.svg").touch()

        main(["--insert", "--before", "./-1.svg", "--allow-negative"])
        out, _ = capsys.readouterr()
        assert out.strip() == "-101"

    def test_no_allow_negative(self, example_dir: Path, capsys: Any) -> None:
        (example_dir / "0.svg").write_text("0")

        main(["--insert", "--before", "0"])

        out, _ = capsys.readouterr()
        assert out.strip() == "0032"

        assert (example_dir / "0066.svg").read_text() == "0"

    def test_dry_run(self, example_dir: Path, capsys: Any) -> None:
        main(["0100.svg", "--after", "0400.svg", "--dry-run"])

        out, _ = capsys.readouterr()
        assert set(out.splitlines()) == {
            "0401.svg -> 0600.svg",
            "0100.svg -> 0500.svg",
        }
        assert {f.name: f.read_text() for f in example_dir.glob("*.svg")} == {
            "0100.svg": "0100",
            "0200.svg": "0200",
            "0300.svg": "0300",
            "0400.svg": "0400",
            "0401.svg": "0401",
        }

    def test_dry_run_insert(self, example_dir: Path, capsys: Any) -> None:
        main(["--insert", "--after", "0400.svg", "--dry-run"])

        out, _ = capsys.readouterr()
        assert set(out.splitlines()) == {
            "0401.svg -> 0600.svg",
            "0500",
        }
        assert {f.name: f.read_text() for f in example_dir.glob("*.svg")} == {
            "0100.svg": "0100",
            "0200.svg": "0200",
            "0300.svg": "0300",
            "0400.svg": "0400",
            "0401.svg": "0401",
        }

    def test_files_in_different_directories(self, tmp_path: Path) -> None:
        (tmp_path / "foo").mkdir()
        (tmp_path / "foo" / "0100.svg").touch()

        (tmp_path / "bar").mkdir()
        (tmp_path / "bar" / "0200.svg").touch()

        with chdir(tmp_path):
            with pytest.raises(FilesNotInSameDirectoryError):
                main(["foo/0100.svg", "--after", "bar/0200.svg"])

    def test_no_source(self, example_dir: Path) -> None:
        with pytest.raises(SystemExit):
            main(["--after", "0100.svg"])

    def test_move_and_insert(self, example_dir: Path) -> None:
        with pytest.raises(SystemExit):
            main(["0300.svg", "--insert", "--after", "0100.svg"])

    def test_move_relative_to_itself(self, example_dir: Path) -> None:
        with pytest.raises(SystemExit):
            main(["0100.svg", "--after", "0100.svg"])
